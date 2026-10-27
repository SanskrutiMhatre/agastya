'use strict';
/*
  Publication approval requests: submission (checkpoint 2b), and review and
  decision (Phase 3, decisions.md M1 to M10).

    GET  /api/projects/:id/approvers              Project Managers an Author may send to, and the default (W1, M5)
    POST /api/projects/:id/requests               submit: validate, build, snapshot, record
    GET  /api/projects/:id/requests               this project's requests
    GET  /api/requests/mine                       the caller's own requests
    GET  /api/requests/queue                      a manager's requests (pending first); the administrator's: all
    GET  /api/requests/:reqId                     one request: snapshot files, modules, history (request.read)
    GET  /api/requests/:reqId/snapshot.pdf        the PDF frozen at submission
    GET  /api/requests/:reqId/validation          the validation report frozen at submission
    GET  /api/requests/:reqId/source?rel=         one frozen source (XML text, or a graphic)
    GET  /api/requests/:reqId/revisions?rel=      a source's revision history up to submission
    GET  /api/requests/:reqId/revisions/:revId    one of those revisions
    POST /api/requests/:reqId/decision            the chosen manager: approve | reject | changes, with a comment
    POST /api/requests/:reqId/withdraw            the submitting Author, while pending
    POST /api/requests/:reqId/override-decision   the administrator: a real decision, with a comment and a reason (V4)
    POST /api/requests/:reqId/override-reset      the administrator: make it stale so the Authors can resubmit (V5)
    POST /api/requests/:reqId/reassign            the administrator: send it to another Project Manager (V6)

  Submission refuses a publication with validation errors or no modules, and
  one that changes while it is being built. The chosen Project Manager reads
  the request and its snapshot only (W2, W5, M1), never the live project. A
  content change that alters a pending request's sources marks it stale, and
  so does a decision attempted on changed content (M2). Every step moves the
  frozen modules' status (content/workflow.js, M3).
*/

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loaders, REASON_MAX } = require('../auth/authz');
const { body } = require('../http/validate');
const { sendError } = require('../http/errors');
const { defaultApproverFor } = require('../auth/accounts');
const { validateProject } = require('../content/validation');
const reqs = require('../content/requests');
const { query } = require('../http/validate');
const { createBuildRunner } = require('../publish/runner');
const workflow = require('../content/workflow');
const { createKit } = require('./kit');

const OUTCOMES = { approve: 'approved', reject: 'rejected', changes: 'changes_requested' };

// `comments`: whether the caller may see the decision comment (decisions.md M6).
function requestOut(r, { comments = true } = {}) {
  return {
    id: r.id, projectId: r.project_id, projectName: r.project_name || null,
    publication: r.publication_ref, title: r.publication_title,
    status: r.status, note: r.note, staleReason: r.stale_reason || null,
    submittedAt: r.submitted_at, updatedAt: r.updated_at,
    submittedBy: { id: r.submitted_by, name: r.submitted_by_name || null },
    manager: { id: r.assigned_manager_id, name: r.manager_name || null },
    validation: { errors: r.validation_errors, warnings: r.validation_warnings },
    decidedAt: r.decided_at || null,
    decidedBy: r.decided_by ? { id: r.decided_by, name: r.decided_by_name || null } : null,
    decisionComment: comments ? r.decision_comment || null : null,
    commentHidden: !comments && !!r.decision_comment,
    // An administrator override (decide or reset), with its reason, shown to the same people as the comment (V4, V5).
    override: r.override_by ? { by: { id: r.override_by, name: r.override_by_name || null }, reason: comments ? r.override_reason || null : null } : null,
    previousRequestId: r.previous_request_id || null,
    snapshotPdf: `/api/requests/${r.id}/snapshot.pdf`,
  };
}

function register(ctx) {
  const { app, store, authz, audit, events, documents, dataDir, log, now, clientIp, overrides } = ctx;
  const { can, requireAuth } = authz;
  const { me, nowIso, dirOf, content } = createKit(ctx);
  const builds = createBuildRunner({ store, events, log, now });

  const announce = (projectId, action, request, user) => events.emit('content', {
    projectId, action, docId: request.id, revision: null, by: user ? user.fullName : null, byId: user ? user.id : null, at: nowIso(),
  });

  /*
    Who sees a decision comment (M6): the submitter, every Author on the
    project, the manager who decided it, the manager the request (or the
    request whose history it belongs to) is addressed to, and the administrator.
  */
  function seesComments(user, r, { addressedTo = null } = {}) {
    if (user.role === 'software_admin') return true;
    if (r.submitted_by === user.id || r.decided_by === user.id || r.assigned_manager_id === user.id) return true;
    if (addressedTo && addressedTo === user.id) return true;
    if (user.role !== 'author') return false;
    const project = store.getProject(r.project_id);
    return !!project && (project.owner_id === user.id || !!store.getMembership(project.id, user.id));
  }

  const manifestOf = (r) => {
    try { return JSON.parse(fs.readFileSync(reqs.snapshotFile(dataDir, r, 'manifest.json'), 'utf8')); } catch { return { files: [] }; }
  };
  const REL = { type: 'string', required: true, max: 300, pattern: /^[A-Za-z0-9._\/-]+$/, label: 'File' };

  app.get('/api/projects/:id/approvers',
    can('request.approvers', loaders.project),
    (req, res) => {
      const managers = store.listUsers({ role: 'project_manager', status: 'active' });
      const fallback = defaultApproverFor(store, store.getUser(me(req).id));
      res.json({
        approvers: managers.map((u) => ({ id: u.id, fullName: u.full_name, username: u.username })),
        defaultId: managers.some((u) => u.id === fallback) ? fallback : null,
      });
    });

  app.post('/api/projects/:id/requests',
    can('request.submit', loaders.requestSubmit),
    body({ approverId: { type: 'string', required: true, max: 64 }, note: { type: 'string', max: 2000 } }),
    content(async (req, res) => {
      const project = req.ctx.project;
      const dir = dirOf(req);
      if (store.findPendingRequest(project.id, reqs.PUBLICATION_REF)) {
        return sendError(res, 409, 'REQUEST_PENDING', 'This publication already has a pending request. Withdraw it first to submit again.');
      }
      const modules = store.listDataModules(project.id);
      const report = await validateProject(dir, modules.map((m) => ({ rel: m.rel_path, schemaType: m.schema_type })));
      store.recordValidation({ projectId: project.id, userId: me(req).id, errors: report.counts.error, warnings: report.counts.warning, modules: report.counts.modules, now: nowIso() });
      if (report.counts.error > 0) {
        // Every error, with the module it is in (decisions.md B6), so the Author can go and fix it.
        const byRel = new Map(modules.map((m) => [m.rel_path, m]));
        const errors = report.findings.filter((f) => f.sev === 'error').map((f) => {
          const m = byRel.get(f.rel);
          return {
            kind: f.kind, line: f.line || 1, message: f.message,
            file: f.rel ? path.posix.basename(f.rel) : null,
            module: m ? { id: m.id, dmc: m.dmc, title: `${m.tech_name}${m.info_name ? ` – ${m.info_name}` : ''}` } : null,
          };
        });
        const where = [...new Set(errors.map((e) => (e.module ? `DMC-${e.module.dmc} (${e.module.title})` : e.file || 'the publication')))];
        return res.status(409).json({
          error: `The publication has ${errors.length} validation error${errors.length === 1 ? '' : 's'} in ${where.length === 1 ? where[0] : `${where.length} places: ${where.slice(0, 5).join('; ')}${where.length > 5 ? '; …' : ''}`}. Fix them before submitting.`,
          code: 'VALIDATION_FAILED', counts: report.counts, errors: errors.slice(0, 200),
        });
      }
      let src;
      try { src = reqs.publicationSources(dir, modules); } catch {
        return sendError(res, 422, 'PM_UNREADABLE', 'publication.xml cannot be read as a publication module.');
      }
      if (!src.files.some((f) => f.startsWith('csdb/'))) {
        return sendError(res, 409, 'EMPTY_PUBLICATION', 'The publication places no data modules. Add modules to it before submitting.');
      }
      const before = reqs.fingerprint(dir, src.files);
      const built = await builds.run({ project, dir, kind: 'snapshot', user: me(req) });
      const after = reqs.fingerprint(dir, reqs.publicationSources(dir, store.listDataModules(project.id)).files);
      if (after.fingerprint !== before.fingerprint) {
        return sendError(res, 409, 'CHANGED_DURING_SUBMIT', 'The publication changed while it was being built. Submit again.');
      }
      const id = crypto.randomUUID();
      const snap = reqs.writeSnapshot({
        dataDir, requestId: id, workspace: dir, sources: before, pdfPath: built.pdf, report,
        meta: { requestId: id, projectId: project.id, submittedBy: me(req).id, submittedAt: nowIso(), title: src.title },
      });
      let request;
      try {
        request = store.createRequest({
          id, projectId: project.id, publicationRef: reqs.PUBLICATION_REF, publicationTitle: src.title, submittedBy: me(req).id,
          managerId: req.ctx.approver.id, note: req.valid.note || '', fingerprint: before.fingerprint, snapshotDir: snap.dir,
          errors: report.counts.error, warnings: report.counts.warning, pdfSha256: snap.pdfSha256, now: nowIso(),
        });
      } catch (e) {
        if (/UNIQUE/.test(e.message)) return sendError(res, 409, 'REQUEST_PENDING', 'This publication already has a pending request.');
        throw e;
      }
      // The history this request continues (M5), and the modules it froze (M3).
      const earlier = store.listRequestsForPublication(project.id, reqs.PUBLICATION_REF).filter((x) => x.id !== id);
      const previous = earlier[earlier.length - 1] || null;
      if (previous) store.setPreviousRequest(id, previous.id);
      const frozen = new Set(before.files.map((f) => f.rel));
      store.addRequestModules(id, modules.filter((m) => frozen.has(m.rel_path)));
      const moved = workflow.applyRequestEvent(store, dataDir, store.getRequest(id), 'submitted');
      const resubmission = previous && ['changes_requested', 'rejected'].includes(previous.status) ? previous.status : null;
      audit({
        actorId: me(req).id, actorUsername: me(req).username, ip: clientIp(req), projectId: project.id,
        action: 'request.submitted', targetType: 'request', targetId: id,
        meta: {
          managerId: req.ctx.approver.id, projectName: project.name, title: src.title, files: before.files.length, authorName: me(req).fullName,
          previousRequestId: previous ? previous.id : null, resubmission, modulesInReview: moved.length,
        },
      });
      request = store.getRequest(id);
      announce(project.id, 'request.submitted', request, me(req));
      res.status(201).json({ request: requestOut(request) });
    }));

  app.get('/api/projects/:id/requests',
    can('content.read', loaders.project),
    (req, res) => res.json({ requests: store.listRequests({ projectId: req.ctx.project.id }).map((r) => requestOut(r, { comments: seesComments(me(req), r) })) }));

  app.get('/api/requests/mine',
    requireAuth(),
    (req, res) => res.json({ requests: store.listRequests({ submittedBy: me(req).id }).map((r) => requestOut(r, { comments: seesComments(me(req), r) })) }));

  app.get('/api/requests/queue',
    can('request.queue'),
    (req, res) => {
      const user = me(req);
      const list = user.role === 'software_admin' ? store.listRequests({ pendingFirst: true, limit: 500 }) : store.listRequests({ managerId: user.id, pendingFirst: true, limit: 500 });
      res.json({ requests: list.map((r) => requestOut(r, { comments: seesComments(user, r) })), pending: list.filter((r) => r.status === 'pending').length });
    });

  app.get('/api/requests/:reqId',
    can('request.read', loaders.publicationRequest),
    (req, res) => {
      const r = req.ctx.request;
      const user = me(req);
      const manifest = manifestOf(r);
      const files = (manifest.files || []).map((f) => ({ rel: f.rel, size: f.size, sha256: f.sha256 }));
      const modules = workflow.modulesOf(store, dataDir, r).map((m) => {
        const dm = store.getDataModule(m.id);
        return dm ? { id: dm.id, dmc: dm.dmc, rel: m.rel_path, title: `${dm.tech_name}${dm.info_name ? ` – ${dm.info_name}` : ''}`, schemaType: dm.schema_type, issue: dm.issue, status: dm.status } : null;
      }).filter(Boolean);
      // The whole history of the publication, each comment shown to whoever may see it (M5, M6).
      const history = store.listRequestsForPublication(r.project_id, r.publication_ref)
        .map((h) => requestOut(h, { comments: seesComments(user, h, { addressedTo: r.assigned_manager_id }) }));
      res.json({
        request: requestOut(r, { comments: seesComments(user, r) }), files, modules, history,
        canDecide: authz.evaluate(user, 'request.decide', { request: r }).ok && r.status === 'pending',
        canOverride: user.role === 'software_admin' && r.status === 'pending',
        // Every override on this request (decision, reset, reassignment), with its reason, for the people involved (V2).
        overrides: seesComments(user, r) ? store.listOverridesForRequest(r.id).map((o) => ({ id: o.id, kind: o.kind, at: o.at, by: o.admin_name, reason: o.reason })) : [],
      });
    });

  app.get('/api/requests/:reqId/validation',
    can('request.read', loaders.publicationRequest),
    (req, res) => {
      const file = reqs.snapshotFile(dataDir, req.ctx.request, 'validation.json');
      let report = null;
      try { report = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return sendError(res, 404, 'NOT_FOUND', 'Not found.'); }
      res.json({ counts: report.counts, findings: (report.findings || []).slice(0, 1000) });
    });

  // One frozen source, only by a path its manifest lists (M10).
  app.get('/api/requests/:reqId/source',
    can('request.read', loaders.publicationRequest),
    query({ rel: REL }),
    (req, res) => {
      const r = req.ctx.request;
      const rel = req.validQuery.rel;
      if (!(manifestOf(r).files || []).some((f) => f.rel === rel)) return sendError(res, 404, 'NOT_FOUND', 'Not found.');
      const file = reqs.snapshotFile(dataDir, r, `sources/${rel}`);
      if (!file || !fs.existsSync(file)) return sendError(res, 404, 'NOT_FOUND', 'Not found.');
      const buf = fs.readFileSync(file);
      if (/\.(xml|json)$/i.test(rel)) return res.json({ rel, text: buf.toString('utf8') });
      const kind = buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : buf.slice(0, 3).toString('ascii') === 'GIF' ? 'image/gif' : null;
      if (!kind) return sendError(res, 415, 'UNSUPPORTED', 'This file cannot be shown.');
      res.set({ 'Content-Type': kind, 'Content-Disposition': 'inline' });
      res.send(buf);
    });

  // A frozen source's revision history up to the moment of submission (immutable revisions; M1).
  app.get('/api/requests/:reqId/revisions',
    can('request.read', loaders.publicationRequest),
    query({ rel: REL }),
    (req, res) => {
      const r = req.ctx.request;
      const rel = req.validQuery.rel;
      if (!(manifestOf(r).files || []).some((f) => f.rel === rel)) return sendError(res, 404, 'NOT_FOUND', 'Not found.');
      const list = store.listRevisionsUntil(r.project_id, rel, r.submitted_at);
      res.json({ revisions: list.map((v) => ({ id: v.id, reason: v.reason, createdAt: v.created_at, by: v.created_by_name || null, size: v.size })) });
    });

  app.get('/api/requests/:reqId/revisions/:revId',
    can('request.read', loaders.publicationRequest),
    (req, res) => {
      const r = req.ctx.request;
      const rev = /^\d+$/.test(req.params.revId) ? store.getRevision(Number(req.params.revId)) : null;
      const doc = rev && store.getDocument(rev.document_id);
      const listed = rev && (manifestOf(r).files || []).some((f) => f.rel === rev.rel_path);
      if (!rev || !doc || doc.project_id !== r.project_id || !listed || rev.created_at > r.submitted_at) return sendError(res, 404, 'NOT_FOUND', 'Not found.');
      res.json({ revision: { id: rev.id, reason: rev.reason, createdAt: rev.created_at, rel: rev.rel_path }, text: documents.revisionContent(rev) });
    });

  /*
    The decision (M2): only on a pending request, with a comment. The live
    content is fingerprinted again first: if it no longer matches the
    snapshot, nothing is decided and the request is stale. The chosen
    manager decides through /decision; the administrator's override
    (/override-decision, V4) is the same decision, labelled, with a reason.
  */
  function decide(req, res, { override = null } = {}) {
    const r = req.ctx.request;
    if (r.status !== 'pending') return sendError(res, 409, 'NOT_PENDING', 'This request has already been decided, withdrawn or made stale.');
    const project = store.getProject(r.project_id);
    const live = project ? reqs.liveFingerprint(documents.workspaceFor(project), store.listDataModules(project.id)) : null;
    if (live !== r.content_fingerprint) {
      if (store.setRequestStatus(r.id, 'stale', nowIso(), { staleReason: 'the publication changed after it was submitted (found when deciding)' })) {
        workflow.applyRequestEvent(store, dataDir, store.getRequest(r.id), 'stale');
        audit({
          actorId: me(req).id, actorUsername: me(req).username, ip: clientIp(req), projectId: r.project_id, action: 'request.stale', targetType: 'request', targetId: r.id,
          meta: { managerId: r.assigned_manager_id, authorId: r.submitted_by, projectName: r.project_name, cause: 'decision.fingerprint' },
        });
        announce(r.project_id, 'request.stale', r, me(req));
      }
      return res.status(409).json({ error: 'The publication changed after it was submitted, so it cannot be decided. The request is now out of date; the Author must submit it again.', code: 'STALE', request: requestOut(store.getRequest(r.id)) });
    }
    const status = OUTCOMES[req.valid.outcome];
    const changed = override
      ? store.overrideDecideRequest(r.id, status, me(req).id, req.valid.comment, override.reason, nowIso())
      : store.decideRequest(r.id, status, me(req).id, req.valid.comment, nowIso());
    if (!changed) return sendError(res, 409, 'NOT_PENDING', 'This request has already been decided.');
    const decided = store.getRequest(r.id);
    const moved = workflow.applyRequestEvent(store, dataDir, decided, status);
    let overrideId = null;
    if (override) {
      // The comment is the Author's to read; only its length is recorded. The reason is recorded (V2).
      overrideId = overrides.record(req, {
        kind: 'decision', action: 'request.decided', projectId: r.project_id, requestId: r.id, reason: override.reason,
        recipients: [r.submitted_by, r.assigned_manager_id],
        meta: { outcome: status, commentLength: req.valid.comment.length, projectName: r.project_name, title: r.publication_title, managerName: r.manager_name },
      });
    }
    audit({
      actorId: me(req).id, actorUsername: me(req).username, ip: clientIp(req), projectId: r.project_id, action: 'request.decided', targetType: 'request', targetId: r.id,
      meta: {
        outcome: status, commentLength: req.valid.comment.length, fingerprint: r.content_fingerprint, authorId: r.submitted_by,
        projectName: r.project_name, title: r.publication_title, managerName: me(req).fullName, modulesMoved: moved.length,
        ...(overrideId ? { overrideId, override: true } : {}),
      },
    });
    announce(r.project_id, 'request.decided', decided, me(req));
    res.json({ request: requestOut(decided), modules: moved });
  }

  const DECISION_BODY = { outcome: { type: 'string', required: true, enum: Object.keys(OUTCOMES), label: 'Decision' }, comment: { type: 'string', required: true, min: 1, max: 4000, label: 'Comment' } };
  const REASON = { type: 'string', required: true, max: REASON_MAX, label: 'Reason' };

  app.post('/api/requests/:reqId/decision',
    can('request.decide', loaders.publicationRequest),
    body(DECISION_BODY),
    (req, res) => decide(req, res));

  app.post('/api/requests/:reqId/override-decision',
    can('request.override', loaders.withReason(loaders.publicationRequest)),
    body({ ...DECISION_BODY, reason: REASON }),
    (req, res) => decide(req, res, { override: { reason: req.valid.reason } }));

  /*
    Reset (V5): the administrator ends a pending request without deciding
    it. It becomes stale with their reason, the lock lifts, the modules
    return to draft, and the Authors can submit again.
  */
  app.post('/api/requests/:reqId/override-reset',
    can('request.override', loaders.withReason(loaders.publicationRequest)),
    body({ reason: REASON }),
    (req, res) => {
      const r = req.ctx.request;
      const reason = req.valid.reason;
      const staleReason = `reset by the administrator: ${reason}`;
      if (!store.overrideResetRequest(r.id, me(req).id, reason, staleReason, nowIso())) return sendError(res, 409, 'NOT_PENDING', 'Only a pending request can be reset.');
      const updated = store.getRequest(r.id);
      workflow.applyRequestEvent(store, dataDir, updated, 'stale');
      const overrideId = overrides.record(req, {
        kind: 'reset', action: 'request.stale', projectId: r.project_id, requestId: r.id, reason,
        recipients: [r.submitted_by, r.assigned_manager_id], meta: { projectName: r.project_name, title: r.publication_title, managerName: r.manager_name },
      });
      audit({
        actorId: me(req).id, actorUsername: me(req).username, ip: clientIp(req), projectId: r.project_id, action: 'request.stale', targetType: 'request', targetId: r.id,
        meta: { managerId: r.assigned_manager_id, authorId: r.submitted_by, projectName: r.project_name, cause: 'admin.reset', overrideId },
      });
      announce(r.project_id, 'request.stale', updated, me(req));
      res.json({ request: requestOut(updated) });
    });

  /*
    Reassign (V6): a pending request goes to another active Project Manager.
    The previous manager loses sight of it (request.read follows the
    assignment); all three people are told.
  */
  app.post('/api/requests/:reqId/reassign',
    can('request.override', loaders.withReason(loaders.publicationRequest)),
    body({ managerId: { type: 'string', required: true, max: 64, label: 'Project Manager' }, reason: REASON }),
    (req, res) => {
      const r = req.ctx.request;
      const to = store.getUser(req.valid.managerId);
      if (!to || to.role !== 'project_manager' || to.disabled_at) return sendError(res, 400, 'APPROVER_INVALID', 'Choose an active Project Manager to send the request to.');
      if (to.id === r.assigned_manager_id) return sendError(res, 409, 'SAME_MANAGER', 'The request is already with that Project Manager.');
      if (!store.reassignRequest(r.id, to.id, nowIso())) return sendError(res, 409, 'NOT_PENDING', 'Only a pending request can be reassigned.');
      const meta = { projectName: r.project_name, title: r.publication_title, fromId: r.assigned_manager_id, fromName: r.manager_name, toId: to.id, toName: to.full_name };
      const overrideId = overrides.record(req, {
        kind: 'reassign', action: 'request.reassigned', projectId: r.project_id, requestId: r.id, reason: req.valid.reason,
        recipients: [r.submitted_by, r.assigned_manager_id, to.id], meta,
      });
      audit({
        actorId: me(req).id, actorUsername: me(req).username, ip: clientIp(req), projectId: r.project_id, action: 'request.reassigned', targetType: 'request', targetId: r.id,
        meta: { ...meta, overrideId },
      });
      const updated = store.getRequest(r.id);
      announce(r.project_id, 'request.reassigned', updated, me(req));
      res.json({ request: requestOut(updated) });
    });

  app.get('/api/requests/:reqId/snapshot.pdf',
    can('request.read', loaders.publicationRequest),
    (req, res) => {
      const file = reqs.snapshotFile(dataDir, req.ctx.request, 'publication.pdf');
      if (!file || !fs.existsSync(file)) return sendError(res, 404, 'NOT_FOUND', 'Not found.');
      res.set({
        'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="submitted-publication.pdf"',
        'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': "default-src 'self'; frame-ancestors 'self'",
      });
      res.send(fs.readFileSync(file));
    });

  app.post('/api/requests/:reqId/withdraw',
    can('request.withdraw', loaders.publicationRequest),
    body({}),
    (req, res) => {
      const r = req.ctx.request;
      if (!store.setRequestStatus(r.id, 'withdrawn', nowIso())) return sendError(res, 409, 'NOT_PENDING', 'Only a pending request can be withdrawn.');
      workflow.applyRequestEvent(store, dataDir, store.getRequest(r.id), 'withdrawn');
      audit({
        actorId: me(req).id, actorUsername: me(req).username, ip: clientIp(req), projectId: r.project_id,
        action: 'request.withdrawn', targetType: 'request', targetId: r.id, meta: { managerId: r.assigned_manager_id, projectName: r.project_name, authorName: me(req).fullName },
      });
      const updated = store.getRequest(r.id);
      announce(r.project_id, 'request.withdrawn', updated, me(req));
      res.json({ request: requestOut(updated) });
    });

  /*
    Stale check: after any content change in a project with a pending
    request, the live sources are fingerprinted again; a mismatch makes the
    request stale. Builds and request events change no sources.
  */
  events.on('content', (e) => {
    if (!e || !e.projectId || /^request\./.test(e.action) || e.action === 'publication.built') return;
    let pending;
    try { pending = store.listPendingRequestsForProject(e.projectId); } catch { return; }
    if (!pending.length) return;
    const project = store.getProject(e.projectId);
    if (!project) return;
    const dir = documents.workspaceFor(project);
    const live = reqs.liveFingerprint(dir, store.listDataModules(project.id));
    for (const r of pending) {
      if (live === r.content_fingerprint) continue;
      // An administrator's override edit names itself and its reason (decisions.md V5).
      const reason = e.override
        ? `edited by the administrator (override): ${e.override.reason}`
        : `${e.action.replace(/[._]/g, ' ')}${e.by ? ` by ${e.by}` : ''}`.slice(0, 200);
      if (!store.setRequestStatus(r.id, 'stale', nowIso(), { staleReason: reason })) continue;
      workflow.applyRequestEvent(store, dataDir, store.getRequest(r.id), 'stale');
      audit({
        actorId: e.byId || null, actorUsername: null, projectId: project.id, action: 'request.stale', targetType: 'request', targetId: r.id,
        meta: {
          managerId: r.assigned_manager_id, authorId: r.submitted_by, projectName: project.name,
          cause: e.override ? 'admin.override' : e.action, ...(e.override ? { overrideId: e.override.id, via: e.action } : {}),
        },
      });
      announce(project.id, 'request.stale', r, null);
    }
  });

}

module.exports = { register, requestOut };
