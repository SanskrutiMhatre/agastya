'use strict';
/*
  Project content (Phase 2, checkpoint 2a): data modules, revisions,
  validation, graphics, DMRL spreadsheets, publication wording settings
  and PDF output.

  Every route is guarded by can() with a content action (authz.js):
  content.read / content.build for anyone who can see the project,
  content.write for the Authors who own or are assigned to it. Every write
  of XML goes through the document service (content/documents.js), so the
  safety guard, conflict detection and revision history always apply.
*/

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const { loaders } = require('../auth/authz');
const { writeFileAtomic } = require('../content/workspace');
const { LockedError } = require('../content/locks');
const workflow = require('../content/workflow');
const { body, query, validateObject } = require('../http/validate');
const { handle, sendError } = require('../http/errors');
const { ContentError, assertWritableXml } = require('../content/xmlcheck');
const dmcLib = require('../content/dmc');
const { renderShell, listShells, SCHEMA_TYPES } = require('../content/shells');
const { validateModule, validateProject, brexIndex } = require('../content/validation');
const graphics = require('../content/graphics');
const dmrl = require('../content/dmrl');
const pdf = require('../publish/pdf');
const { createBuildRunner } = require('../publish/runner');
const pmc = require('../../vendor/engine/pmc');
const { resolveDmRefs } = require('../../vendor/engine/resolveDmRefs');

const upload = (maxBytes) => multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1, fields: 10, fieldSize: 64 * 1024 } }).single('file');

// Per-module previews, kept for the inline viewer; never part of a build.
const PREVIEW_DIR = '.previews';

/*
  A PDF the client shows inline in a frame on its own page: this response
  alone may be framed by the same origin (the app default is DENY).
*/
function sendInlinePdf(res, buf, name) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${name}"`,
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'self'",
  });
  res.send(buf);
}

const DMC_SCHEMA = {
  ...Object.fromEntries(dmcLib.NAMES.map((n) => [n, { type: 'string', required: true, max: 14 }])),
  learnCode: { type: 'string', max: 3 }, learnEventCode: { type: 'string', max: 1 },
};

// Defaults for new modules, as in the Agastya original (DMRL import and Create dialog).
const NEW_DM_DEFAULTS = { languageIsoCode: 'en', countryIsoCode: 'IN', securityClassification: '01', issueNumber: '001', inWork: '00' };

function dmOut(m) {
  return {
    id: m.id, dmc: m.dmc, file: path.posix.basename(m.rel_path), schemaType: m.schema_type, issue: m.issue,
    techName: m.tech_name, infoName: m.info_name, status: m.status,
    createdAt: m.created_at, updatedAt: m.updated_at, updatedBy: m.updated_by_name || null,
    deletedAt: m.deleted_at || null,
  };
}

const revOut = (r) => ({ id: r.id, reason: r.reason, createdAt: r.created_at, by: r.created_by_name || r.created_by_username || null, size: r.size, hash: r.hash });

function register({ app, store, authz, audit, now, clientIp, log, dataDir, documents, events, locks }) {
  const { can } = authz;
  const nowIso = () => now().toISOString();
  const me = (req) => req.auth.user;
  const builds = createBuildRunner({ store, events, log, now });
  // Every content change is audited and announced on the hub (WebSocket, request stale check).
  const auditContent = (req, action, extra = {}) => {
    audit({ actorId: me(req).id, actorUsername: me(req).username, ip: clientIp(req), projectId: req.ctx.project.id, ...extra, action });
    events.emit('content', {
      projectId: req.ctx.project.id, action, docId: extra.targetId || null,
      revision: (extra.meta && extra.meta.revision) || null, by: me(req).fullName, byId: me(req).id, at: nowIso(),
    });
  };

  // Content errors become their status and code; anything else is the 500 handler's.
  const content = (fn) => handle(async (req, res, next) => {
    try { await fn(req, res, next); } catch (e) {
      if (e instanceof ContentError) {
        return res.status(e.status).json({ error: e.message, code: e.code, line: e.line, conflict: e.conflict });
      }
      if (e instanceof LockedError) return res.status(423).json({ error: e.message, code: e.code, lock: e.lock });
      if (e instanceof pdf.BuildError) {
        return res.status(422).json({ error: `The PDF build failed: ${e.message}`, code: e.code, hint: e.hint, file: e.file, line: e.line });
      }
      throw e;
    }
  });

  const dirOf = (req) => documents.workspaceFor(req.ctx.project);
  // The content lock (decisions.md L1): the locked files of a project, and the guard on writes.
  const lockedOf = (req) => locks.lockedFiles(req.ctx.project.id);
  const assertUnlocked = (req, rel) => locks.assertUnlocked(me(req), req.ctx.project.id, rel);
  const needDm = (req, res) => {
    if (!req.ctx.dm) { sendError(res, 404, 'NOT_FOUND', 'Not found.'); return null; }
    return req.ctx.dm;
  };

  // The project's own BREX code, if it has one, for new modules to name;
  // otherwise the shell's reference is kept (BREX checks fall back to the default).
  function projectBrex(dir) {
    const first = [...brexIndex(dir).keys()][0];
    return (first && dmcLib.parseDmcString(first)) || null;
  }

  // Create the record and the file for a new data module from its XML.
  async function createModule(req, xml, reason) {
    const project = req.ctx.project;
    await assertWritableXml(xml); // the safety guard comes before anything reads the content
    const id = dmcLib.readIdentity(xml);
    if (!id.isDataModule || !id.dmc) throw new ContentError(400, 'NOT_A_DATA_MODULE', 'This is not an S1000D data module with a valid data module code in its dmIdent.');
    const code = dmcLib.formatDmc(id.dmc);
    if (store.findLiveDataModule(project.id, code)) throw new ContentError(409, 'DMC_TAKEN', `Data module ${code} already exists in this project.`);
    const { doc, revision } = await documents.writeDocument({
      project, rel: `csdb/${dmcLib.dmcFilename(id.dmc)}`, kind: 'dm', content: xml, userId: me(req).id, reason,
    });
    const dm = store.createDataModule({
      id: crypto.randomUUID(), projectId: project.id, documentId: doc.id, dmc: code,
      schemaType: id.schemaType || 'descript', issue: id.issue, techName: id.techName, infoName: id.infoName, userId: me(req).id, now: nowIso(),
    });
    return { dm, revision };
  }

  // ---- data modules -----------------------------------------------------

  app.get('/api/projects/:id/dms',
    can('content.read', loaders.project),
    query({ search: { type: 'string', max: 200 }, fields: { type: 'string', max: 40 }, deleted: { type: 'string', enum: ['0', '1'] } }),
    content(async (req, res) => {
      const dir = dirOf(req);
      const locked = lockedOf(req);
      let list = store.listDataModules(req.ctx.project.id, { includeDeleted: req.validQuery.deleted === '1' });
      const q = (req.validQuery.search || '').toLowerCase();
      if (q) {
        const fields = (req.validQuery.fields || 'title,code').split(',');
        list = list.filter((m) => {
          if (fields.includes('code') && m.dmc.toLowerCase().includes(q)) return true;
          if (fields.includes('title') && `${m.tech_name} ${m.info_name}`.toLowerCase().includes(q)) return true;
          if (fields.includes('content') && !m.deleted_at) {
            try {
              const text = fs.readFileSync(path.join(dir, m.rel_path), 'utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
              return text.includes(q);
            } catch { return false; }
          }
          return false;
        });
      }
      res.json({ modules: list.map((m) => ({ ...dmOut(m), locked: !m.deleted_at && locked.has(m.rel_path) })), lock: [...locked.values()][0] || null, schemaTypes: Object.entries(SCHEMA_TYPES).map(([id, t]) => ({ id, label: t.label })), shells: listShells() });
    }));

  app.post('/api/projects/:id/dms',
    can('content.write', loaders.project),
    body({
      dmc: { type: 'object', required: true },
      techName: { type: 'string', required: true, max: 200, label: 'Technical name' },
      infoName: { type: 'string', max: 200, label: 'Information name' },
      schemaType: { type: 'string', required: true, enum: Object.keys(SCHEMA_TYPES), label: 'Schema' },
      templateId: { type: 'string', max: 20, pattern: /^[a-z]+\d\d$/, label: 'Shell' },
      languageIsoCode: { type: 'string', max: 3, pattern: /^[a-z]{2,3}$/, label: 'Language' },
      countryIsoCode: { type: 'string', max: 2, pattern: /^[A-Z]{2}$/, label: 'Country' },
      securityClassification: { type: 'string', max: 20, pattern: /^(\d{2}|UNCLASSIFIED|RESTRICTED|CONFIDENTIAL|SECRET|TOP SECRET)$/i, label: 'Security classification' },
      issueNumber: { type: 'string', max: 3, pattern: /^\d{3}$/, label: 'Issue number' },
      inWork: { type: 'string', max: 2, pattern: /^\d{2}$/, label: 'In work' },
      originator: { type: 'string', max: 5, pattern: /^[A-Z0-9]{5}$/i, label: 'Originator CAGE' },
      rpcCode: { type: 'string', max: 5, pattern: /^[A-Z0-9]{5}$/i, label: 'RPC CAGE' },
    }),
    content(async (req, res) => {
      const shape = validateObject(DMC_SCHEMA, req.valid.dmc);
      if (!shape.ok) return sendError(res, 400, shape.code, shape.error);
      const v = dmcLib.validateDmc(shape.value);
      if (!v.ok) return sendError(res, 400, 'VALIDATION', v.error);
      const dir = dirOf(req);
      let xml;
      try {
        xml = renderShell({
          ...NEW_DM_DEFAULTS, ...req.valid, dmc: v.dmc, brex: projectBrex(dir), date: now(),
          originator: req.valid.originator && req.valid.originator.toUpperCase(), rpcCode: req.valid.rpcCode && req.valid.rpcCode.toUpperCase(),
        });
      } catch { return sendError(res, 400, 'VALIDATION', 'That shell does not exist for the chosen schema.'); }
      const shell = req.valid.templateId || (listShells().find((x) => x.schemaType === req.valid.schemaType) || {}).id;
      const { dm, revision } = await createModule(req, xml, `Created from shell ${shell}`);
      auditContent(req, 'dm.created', { targetType: 'dm', targetId: dm.id, meta: { dmc: dm.dmc, schemaType: dm.schema_type } });
      res.status(201).json({ ok: true, module: dmOut(dm), revision: revision.id });
    }));

  // Import a single XML data module, sent as text.
  app.post('/api/projects/:id/dms/import',
    can('content.write', loaders.project),
    body({ filename: { type: 'string', max: 200 }, content: { type: 'password', required: true, max: 8 * 1024 * 1024 } }),
    content(async (req, res) => {
      const { dm, revision } = await createModule(req, req.valid.content, `Imported${req.valid.filename ? ` from ${path.basename(req.valid.filename).slice(0, 120)}` : ''}`);
      auditContent(req, 'dm.imported', { targetType: 'dm', targetId: dm.id, meta: { dmc: dm.dmc } });
      res.status(201).json({ ok: true, module: dmOut(dm), revision: revision.id });
    }));

  app.get('/api/projects/:id/dms/:dmId',
    can('content.read', loaders.dataModule),
    content(async (req, res) => {
      const dm = needDm(req, res); if (!dm) return;
      const doc = store.getDocument(dm.document_id);
      if (dm.deleted_at) {
        const head = store.headRevision(doc.id);
        return res.json({ module: dmOut(dm), xml: documents.revisionContent(head), revision: head.id, readOnly: true });
      }
      const { content: xml, head } = documents.readDocument(req.ctx.project, doc);
      const lock = locks.lockOf(req.ctx.project.id, dm.rel_path);
      res.json({ module: dmOut(dm), xml, revision: head.id, revisionBy: head.created_by_name || null, revisionAt: head.created_at, lock });
    }));

  // Save. Conflict detection is revision-based: 409 if baseRevision is stale.
  app.put('/api/projects/:id/dms/:dmId',
    can('content.write', loaders.dataModule),
    body({ xml: { type: 'password', required: true, max: 8 * 1024 * 1024 }, baseRevision: { type: 'integer', required: true, min: 1 } }),
    content(async (req, res) => {
      const dm = needDm(req, res); if (!dm) return;
      if (dm.deleted_at) return sendError(res, 409, 'DELETED', 'Restore this data module before editing it.');
      const project = req.ctx.project;
      assertUnlocked(req, dm.rel_path);
      await assertWritableXml(req.valid.xml);
      const id = dmcLib.readIdentity(req.valid.xml);
      if (!id.isDataModule || !id.dmc) return sendError(res, 400, 'NOT_A_DATA_MODULE', 'The XML must stay an S1000D data module with a valid data module code.');
      const newCode = dmcLib.formatDmc(id.dmc);
      if (newCode !== dm.dmc && store.findLiveDataModule(project.id, newCode)) {
        return sendError(res, 409, 'DMC_TAKEN', `Data module ${newCode} already exists in this project.`);
      }
      let doc = store.getDocument(dm.document_id);
      const { revision } = await documents.writeDocument({
        project, doc, content: req.valid.xml, baseRevision: req.valid.baseRevision, userId: me(req).id, reason: 'Saved',
      });
      // The code is the file name: a changed code renames the file, history follows.
      if (newCode !== dm.dmc) {
        doc = documents.moveDocument(project, doc, `csdb/${dmcLib.dmcFilename(id.dmc)}`);
        auditContent(req, 'dm.renamed', { targetType: 'dm', targetId: dm.id, meta: { from: dm.dmc, to: newCode } });
      }
      store.updateDataModule(dm.id, {
        dmc: newCode, schema_type: id.schemaType || dm.schema_type, issue: id.issue, tech_name: id.techName, info_name: id.infoName,
      }, me(req).id, nowIso());
      // An approved module that is changed is a draft again (decisions.md M3).
      const backToDraft = workflow.afterSave(store, dm);
      auditContent(req, 'dm.saved', { targetType: 'dm', targetId: dm.id, meta: { dmc: newCode, revision: revision.id, ...(backToDraft ? { status: 'approved->draft' } : {}) } });
      store.deleteDraft(me(req).id, req.ctx.project.id, `dm-${dm.id}`); // the save supersedes the autosaved draft
      res.json({ ok: true, module: dmOut(store.getDataModule(dm.id)), revision: revision.id });
    }));

  // Soft delete: the file moves to .deleted/ (never built); record and history are kept.
  app.delete('/api/projects/:id/dms/:dmId',
    can('content.write', loaders.dataModule),
    body({}),
    content(async (req, res) => {
      const dm = needDm(req, res); if (!dm) return;
      if (dm.deleted_at) return res.json({ ok: true, module: dmOut(dm) });
      assertUnlocked(req, dm.rel_path);
      const doc = store.getDocument(dm.document_id);
      documents.readDocument(req.ctx.project, doc); // record any outside change before moving
      documents.moveDocument(req.ctx.project, doc, `.deleted/${dm.id}-${path.posix.basename(doc.rel_path)}`, { deleted: nowIso() });
      store.updateDataModule(dm.id, { deleted_at: nowIso(), deleted_by: me(req).id }, me(req).id, nowIso());
      auditContent(req, 'dm.deleted', { targetType: 'dm', targetId: dm.id, meta: { dmc: dm.dmc } });
      res.json({ ok: true, module: dmOut(store.getDataModule(dm.id)) });
    }));

  app.post('/api/projects/:id/dms/:dmId/restore',
    can('content.write', loaders.dataModule),
    body({}),
    content(async (req, res) => {
      const dm = needDm(req, res); if (!dm) return;
      if (!dm.deleted_at) return res.json({ ok: true, module: dmOut(dm) });
      if (store.findLiveDataModule(req.ctx.project.id, dm.dmc)) return sendError(res, 409, 'DMC_TAKEN', `Another data module ${dm.dmc} now exists in this project.`);
      const doc = store.getDocument(dm.document_id);
      const parsed = dmcLib.parseDmcString(dm.dmc);
      documents.moveDocument(req.ctx.project, doc, `csdb/${dmcLib.dmcFilename(parsed)}`, { deleted: null });
      store.updateDataModule(dm.id, { deleted_at: null, deleted_by: null }, me(req).id, nowIso());
      auditContent(req, 'dm.restored', { targetType: 'dm', targetId: dm.id, meta: { dmc: dm.dmc } });
      res.json({ ok: true, module: dmOut(store.getDataModule(dm.id)) });
    }));

  app.get('/api/projects/:id/dms/:dmId/revisions',
    can('content.read', loaders.dataModule),
    content(async (req, res) => {
      const dm = needDm(req, res); if (!dm) return;
      res.json({ revisions: store.listRevisions(dm.document_id).map(revOut) });
    }));

  app.get('/api/projects/:id/dms/:dmId/revisions/:revId',
    can('content.read', loaders.dataModule),
    content(async (req, res) => {
      const dm = needDm(req, res); if (!dm) return;
      const rev = /^\d{1,12}$/.test(req.params.revId) ? store.getRevision(req.params.revId) : null;
      if (!rev || rev.document_id !== dm.document_id) return sendError(res, 404, 'NOT_FOUND', 'Not found.');
      res.json({ revision: revOut({ ...rev, size: Buffer.byteLength(documents.revisionContent(rev)) }), xml: documents.revisionContent(rev) });
    }));

  // Validate the saved module, or text from the editor (not saved).
  app.post('/api/projects/:id/dms/:dmId/validate',
    can('content.read', loaders.dataModule),
    body({ xml: { type: 'password', max: 8 * 1024 * 1024 }, issue: { type: 'string', max: 4, pattern: /^(auto|[0-9][.][0-9])$/, label: 'Issue' } }),
    content(async (req, res) => {
      const dm = needDm(req, res); if (!dm) return;
      const dir = dirOf(req);
      const text = req.valid.xml !== undefined ? req.valid.xml
        : dm.deleted_at ? documents.revisionContent(store.headRevision(dm.document_id))
          : documents.readDocument(req.ctx.project, store.getDocument(dm.document_id)).content;
      res.json(await validateModule(dir, dm.rel_path, text, { schemaType: dm.schema_type, issue: req.valid.issue || null }));
    }));

  app.post('/api/projects/:id/validate',
    can('content.read', loaders.project),
    body({}),
    content(async (req, res) => {
      const dir = dirOf(req);
      const mods = store.listDataModules(req.ctx.project.id).map((m) => ({ rel: m.rel_path, schemaType: m.schema_type }));
      const result = await validateProject(dir, mods);
      store.recordValidation({ projectId: req.ctx.project.id, userId: me(req).id, errors: result.counts.error, warnings: result.counts.warning, modules: result.counts.modules, now: nowIso() });
      res.json(result);
    }));

  // ---- publication module (raw XML; the structured builder arrives in 2b) -----

  app.get('/api/projects/:id/publication',
    can('content.read', loaders.project),
    content(async (req, res) => {
      const doc = documents.ensureDocument(req.ctx.project, 'publication.xml', 'pm');
      const { content: xml, head } = documents.readDocument(req.ctx.project, doc);
      res.json({ xml, revision: head.id, revisionBy: head.created_by_name || null, revisionAt: head.created_at, lock: locks.lockOf(req.ctx.project.id, 'publication.xml') });
    }));

  /*
    Save guards, from the Agastya original (services/PmcService.writePm):
    the index must read back as a publication module (vendor/engine/pmc.js),
    and an index with no entries is refused unless ?allowEmpty=1, because it
    builds a book with no content. The original's publication.xml.bak is
    covered by the immutable revision history. Entries that name no data
    module in the project are reported, not refused (the author may be
    planning ahead); validation and the build report them as errors.
  */
  app.put('/api/projects/:id/publication',
    can('content.write', loaders.project),
    query({ allowEmpty: { type: 'string', enum: ['0', '1', 'true', 'false'] } }),
    body({ xml: { type: 'password', required: true, max: 8 * 1024 * 1024 }, baseRevision: { type: 'integer', required: true, min: 1 } }),
    content(async (req, res) => {
      if (!/<pm[\s>]/.test(req.valid.xml) || /<dmodule[\s>]/.test(req.valid.xml)) {
        return sendError(res, 400, 'NOT_A_PUBLICATION_MODULE', 'The XML must be an S1000D publication module (<pm>).');
      }
      assertUnlocked(req, 'publication.xml');
      await assertWritableXml(req.valid.xml);
      let parsed;
      try { parsed = pmc.parsePm(req.valid.xml); } catch { return sendError(res, 400, 'NOT_A_PUBLICATION_MODULE', 'The XML must be an S1000D publication module with a <pm> root element.'); }
      const counts = pmc.countEntries(parsed.entries);
      const allowEmpty = ['1', 'true'].includes(req.validQuery.allowEmpty);
      if (counts.total === 0 && !allowEmpty) {
        return sendError(res, 400, 'EMPTY_PUBLICATION', 'Refusing to save an empty publication: it has no chapters or data module entries. Save again with "allow empty" if that is intended.');
      }
      const unresolved = (resolveDmRefs(req.valid.xml, path.join(dirOf(req), 'csdb'), 'csdb').unresolved || []).map((u) => ({ code: u.code, title: u.title || '' }));
      const doc = documents.ensureDocument(req.ctx.project, 'publication.xml', 'pm');
      const { revision } = await documents.writeDocument({
        project: req.ctx.project, doc, content: req.valid.xml, baseRevision: req.valid.baseRevision, userId: me(req).id, reason: 'Saved',
      });
      auditContent(req, 'publication.saved', { targetType: 'project', targetId: req.ctx.project.id, meta: { revision: revision.id, entries: counts.total, unresolved: unresolved.length } });
      store.deleteDraft(me(req).id, req.ctx.project.id, 'publication');
      res.json({ ok: true, revision: revision.id, counts, unresolved, warnings: parsed.warnings.slice(0, 50) });
    }));

  // ---- publication wording (project.json frontMatter.labels) -----------------

  /*
    The fixed JSS wording on the front-matter pages, as project settings. A
    blank value means the default (the JSS text); "-" leaves an authority
    line out. Stored where the engine already reads label overrides
    (frontMatter.labels.<page>.<key> -> $fm.label.<page>.<key>).
  */
  const WORDING = {
    authorityHeading: { page: 'title', key: 'authorityHeading', label: 'Authority heading', default: 'Under the Authority of' },
    authority: { page: 'title', key: 'authority', label: 'Authority line', default: 'Secretary, Ministry of Defence, Govt. of India' },
    documentNo: { page: 'foreword', key: 'documentNo', label: 'Document number label', default: 'L&T Document No.: ' },
  };
  const projectJsonPath = (req) => path.join(dirOf(req), 'project.json');
  function readProjectJson(req) {
    try { return JSON.parse(fs.readFileSync(projectJsonPath(req), 'utf8')); } catch { throw new ContentError(500, 'SETTINGS_UNREADABLE', 'The project settings could not be read.'); }
  }
  const wordingOf = (pj) => Object.fromEntries(Object.entries(WORDING).map(([k, w]) => {
    const v = pj.frontMatter && pj.frontMatter.labels && pj.frontMatter.labels[w.page] && pj.frontMatter.labels[w.page][w.key];
    return [k, typeof v === 'string' ? v : ''];
  }));
  const wordingDefaults = () => Object.fromEntries(Object.entries(WORDING).map(([k, w]) => [k, { label: w.label, default: w.default }]));

  app.get('/api/projects/:id/settings/wording',
    can('content.read', loaders.project),
    content(async (req, res) => {
      res.json({ wording: wordingOf(readProjectJson(req)), fields: wordingDefaults(), lock: locks.lockOf(req.ctx.project.id, 'project.json') });
    }));

  app.put('/api/projects/:id/settings/wording',
    can('content.write', loaders.project),
    body(Object.fromEntries(Object.entries(WORDING).map(([k, w]) => [k, { type: 'string', max: 200, pattern: /^[^\u0000-\u001f\u007f]*$/, label: w.label }]))),
    content(async (req, res) => {
      assertUnlocked(req, 'project.json'); // the build settings of a submitted publication are frozen with it
      const pj = readProjectJson(req);
      const before = wordingOf(pj);
      pj.frontMatter = pj.frontMatter && typeof pj.frontMatter === 'object' ? pj.frontMatter : {};
      pj.frontMatter.labels = pj.frontMatter.labels && typeof pj.frontMatter.labels === 'object' ? pj.frontMatter.labels : {};
      const changed = [];
      for (const [k, w] of Object.entries(WORDING)) {
        if (req.valid[k] === undefined) continue;
        // The document number follows its label directly, so the label keeps a trailing space (as the default does).
        const v = req.valid[k].trim() === '' ? '' : (k === 'documentNo' && req.valid[k] !== '-' ? `${req.valid[k].trimEnd()} ` : req.valid[k]);
        const page = pj.frontMatter.labels[w.page] && typeof pj.frontMatter.labels[w.page] === 'object' ? pj.frontMatter.labels[w.page] : {};
        if (v === '') delete page[w.key]; else page[w.key] = v;
        pj.frontMatter.labels[w.page] = page;
        if ((before[k] || '') !== v) changed.push(k);
      }
      writeFileAtomic(projectJsonPath(req), JSON.stringify(pj, null, 2) + '\n');
      if (changed.length) auditContent(req, 'settings.wording_changed', { targetType: 'project', targetId: req.ctx.project.id, meta: { fields: changed } });
      res.json({ ok: true, wording: wordingOf(pj), changed });
    }));

  // ---- PDF -----------------------------------------------------------------

  app.post('/api/projects/:id/dms/:dmId/preview',
    can('content.build', loaders.dataModule),
    body({}),
    content(async (req, res) => {
      const dm = needDm(req, res); if (!dm) return;
      if (dm.deleted_at) return sendError(res, 409, 'DELETED', 'A deleted data module cannot be previewed.');
      const dir = dirOf(req);
      const r = await builds.run({ project: req.ctx.project, dir, kind: 'preview', user: me(req), target: dm.dmc, dmRel: dm.rel_path });
      const buf = fs.readFileSync(r.pdf);
      // Kept per module so the editor can show it inline (GET .../preview.pdf).
      writeFileAtomic(path.join(dir, PREVIEW_DIR, `${dm.id}.pdf`), buf);
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${path.posix.basename(dm.rel_path, '.xml')}-preview.pdf"`, 'X-Build-Ms': String(r.totalMs) });
      res.send(buf);
    }));

  app.get('/api/projects/:id/dms/:dmId/preview.pdf',
    can('content.read', loaders.dataModule),
    query({ v: { type: 'string', max: 20, pattern: /^\d+$/ } }),
    (req, res) => {
      const dm = needDm(req, res); if (!dm) return;
      const file = path.join(dirOf(req), PREVIEW_DIR, `${dm.id}.pdf`);
      if (!fs.existsSync(file)) return sendError(res, 404, 'NOT_BUILT', 'No preview has been built for this data module yet.');
      sendInlinePdf(res, fs.readFileSync(file), `${path.posix.basename(dm.rel_path, '.xml')}-preview.pdf`);
    });

  app.post('/api/projects/:id/build',
    can('content.build', loaders.project),
    body({}),
    content(async (req, res) => {
      const dir = dirOf(req);
      const r = await builds.run({ project: req.ctx.project, dir, kind: 'full', user: me(req) });
      auditContent(req, 'publication.built', { targetType: 'project', targetId: req.ctx.project.id, meta: { ms: r.totalMs } });
      res.json({ ok: true, totalMs: r.totalMs, messages: r.messages, notes: r.notes, pdfUrl: `/api/projects/${req.ctx.project.id}/output.pdf` });
    }));

  app.get('/api/projects/:id/output.pdf',
    can('content.read', loaders.project),
    query({ download: { type: 'string', enum: ['0', '1'] }, v: { type: 'string', max: 20, pattern: /^\d+$/ } }),
    (req, res) => {
      const file = path.join(dirOf(req), pdf.OUTPUT.pdf);
      if (!fs.existsSync(file)) return sendError(res, 404, 'NOT_BUILT', 'The publication has not been built yet.');
      const name = `${req.ctx.project.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'publication'}.pdf`;
      if (req.validQuery.download === '1') {
        res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"` });
        return res.send(fs.readFileSync(file));
      }
      sendInlinePdf(res, fs.readFileSync(file), name);
    });

  app.get('/api/projects/:id/builds/last',
    can('content.read', loaders.project),
    (req, res) => {
      const b = store.lastBuild(req.ctx.project.id, 'full');
      const v = store.lastValidation(req.ctx.project.id);
      const built = fs.existsSync(path.join(dirOf(req), pdf.OUTPUT.pdf));
      res.json({
        build: b ? { ok: !!b.ok, ms: b.ms, at: b.at, by: b.user_name || null, errorCode: b.error_code } : null,
        validation: v ? { errors: v.errors, warnings: v.warnings, modules: v.modules, at: v.at } : null,
        pdfAvailable: built,
      });
    });

  // ---- graphics --------------------------------------------------------------

  app.get('/api/projects/:id/graphics',
    can('content.read', loaders.project),
    content(async (req, res) => {
      const dir = dirOf(req);
      const live = store.listDataModules(req.ctx.project.id);
      const texts = live.map((m) => { try { return { m, text: fs.readFileSync(path.join(dir, m.rel_path), 'utf8') }; } catch { return null; } }).filter(Boolean);
      const declared = graphics.declaredEntities(texts.map((t) => t.text));
      // Keyed case-insensitively; the modules' spelling is shown.
      const refs = new Map();
      for (const t of texts) for (const icn of graphics.referencedIcns(t.text)) {
        const k = graphics.icnKey(icn);
        if (!refs.has(k)) refs.set(k, { icn, usedBy: [] });
        refs.get(k).usedBy.push(t.m.dmc);
      }
      const registry = new Map(store.listGraphics(req.ctx.project.id).map((g) => [graphics.icnKey(g.icn), g]));
      const keys = new Set([...refs.keys(), ...registry.keys()]);
      const out = [...keys].sort().map((k) => {
        const g = registry.get(k);
        const icn = refs.has(k) ? refs.get(k).icn : g.icn;
        const found = graphics.findFile(dir, icn, declared);
        const exp = graphics.expectedLocation(icn, declared);
        return {
          icn, title: g ? g.title : '', usedBy: refs.has(k) ? refs.get(k).usedBy : [], expected: exp.rel, file: found,
          present: !!found, resolves: found === exp.rel, format: g ? g.format : null, size: g ? g.size : null,
          uploadedBy: g ? g.uploaded_by_name : null, uploadedAt: g ? g.uploaded_at : null,
        };
      });
      res.json({ graphics: out, counts: { total: out.length, missing: out.filter((g) => g.usedBy.length && !g.present).length } });
    }));

  app.post('/api/projects/:id/graphics',
    can('content.write', loaders.project),
    upload(graphics.MAX_GRAPHIC_BYTES),
    content(async (req, res) => {
      const fields = validateObject({ icn: { type: 'string', max: 90 }, title: { type: 'string', max: 200 } }, req.body || {});
      if (!fields.ok) return sendError(res, 400, fields.code, fields.error);
      if (!req.file) return sendError(res, 400, 'VALIDATION', 'Choose an image file to upload.');
      const given = graphics.normaliseIcn(fields.value.icn || path.basename(req.file.originalname || ''));
      if (!graphics.ICN_RE.test(given)) return sendError(res, 400, 'BAD_ICN', 'The ICN must look like ICN-…, using letters, digits and hyphens only.');
      const format = graphics.detectFormat(req.file.buffer);
      if (!format) return sendError(res, 415, 'UNSUPPORTED_IMAGE', 'Only PNG, JPEG and GIF images are accepted.');

      const dir = dirOf(req);
      const texts = store.listDataModules(req.ctx.project.id).map((m) => { try { return fs.readFileSync(path.join(dir, m.rel_path), 'utf8'); } catch { return ''; } });
      const icn = graphics.canonicalIcn(given, texts.flatMap((t) => graphics.referencedIcns(t)));
      const exp = graphics.expectedLocation(icn, graphics.declaredEntities(texts));
      const expExt = path.extname(exp.rel).toLowerCase();
      const matches = (format === 'png' && expExt === '.png') || (format === 'jpeg' && /\.jpe?g$/.test(expExt)) || (format === 'gif' && expExt === '.gif');
      const rel = matches ? exp.rel : `${path.posix.dirname(exp.rel)}/${icn}${graphics.EXT[format]}`;
      assertUnlocked(req, rel); // a graphic of a submitted publication is frozen with it
      const abs = documents.absFor(req.ctx.project, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, req.file.buffer);
      const sha = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      store.upsertGraphic({ id: crypto.randomUUID(), projectId: req.ctx.project.id, icn, relPath: rel, format, size: req.file.size, sha256: sha, title: fields.value.title, userId: me(req).id, now: nowIso() });
      auditContent(req, 'graphic.uploaded', { targetType: 'graphic', targetId: icn, meta: { icn, format, size: req.file.size, file: rel } });
      res.status(201).json({
        ok: true, icn, file: rel, expected: exp.rel, resolves: matches,
        warning: matches ? undefined : `The build looks for ${exp.rel}, but this is a ${format.toUpperCase()} image; it was stored as ${rel} and will not appear in the PDF until the module's declaration or the file is changed.`,
      });
    }));

  app.get('/api/projects/:id/graphics/next-icn',
    can('content.read', loaders.project),
    (req, res) => {
      const dir = dirOf(req);
      const existing = [...graphics.icnFiles(dir), ...store.listGraphics(req.ctx.project.id).map((g) => g.icn)];
      const live = store.listDataModules(req.ctx.project.id);
      const model = live[0] ? live[0].dmc.split('-')[0] : req.ctx.project.name;
      res.json({ icn: graphics.nextIcn(existing, model), existing: new Set(existing.map(graphics.icnKey)).size });
    });

  app.get('/api/projects/:id/graphics/:icn/file',
    can('content.read', loaders.project),
    (req, res) => {
      const icn = graphics.normaliseIcn(req.params.icn);
      if (!graphics.ICN_RE.test(icn)) return sendError(res, 400, 'BAD_ICN', 'Invalid ICN.');
      const dir = dirOf(req);
      const texts = store.listDataModules(req.ctx.project.id).map((m) => { try { return fs.readFileSync(path.join(dir, m.rel_path), 'utf8'); } catch { return ''; } });
      const rel = graphics.findFile(dir, icn, graphics.declaredEntities(texts));
      const abs = rel && documents.absFor(req.ctx.project, rel);
      if (!abs || !fs.existsSync(abs)) return sendError(res, 404, 'NOT_FOUND', 'Not found.');
      const buf = fs.readFileSync(abs);
      const format = graphics.detectFormat(buf);
      if (!format) return sendError(res, 415, 'UNSUPPORTED_IMAGE', 'Not a supported image.');
      res.set({ 'Content-Type': graphics.MIME[format], 'Content-Disposition': 'inline' });
      res.send(buf);
    });

  // ---- DMRL ------------------------------------------------------------------

  app.get('/api/projects/:id/dmrl',
    can('content.read', loaders.project),
    content(async (req, res) => {
      const buf = await dmrl.exportDmrl(req.ctx.project, store.listDataModules(req.ctx.project.id));
      const name = `DMRL-${req.ctx.project.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) || req.ctx.project.id}.xlsx`;
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}"` });
      res.send(buf);
    }));

  const DMRL_FIELDS = { schemaType: { type: 'string', enum: [...Object.keys(SCHEMA_TYPES), 'auto'], label: 'Schema' } };

  async function readUpload(req) {
    if (!req.file) throw new ContentError(400, 'VALIDATION', 'Choose a DMRL spreadsheet (.xlsx) to upload.');
    try { return await dmrl.readDmrl(req.file.buffer); } catch { throw new ContentError(400, 'UNREADABLE', 'The spreadsheet could not be read. Save it as an Excel .xlsx workbook and try again.'); }
  }

  app.post('/api/projects/:id/dmrl/preview',
    can('content.write', loaders.project),
    upload(10 * 1024 * 1024),
    content(async (req, res) => {
      const fields = validateObject(DMRL_FIELDS, req.body || {});
      if (!fields.ok) return sendError(res, 400, fields.code, fields.error);
      const sheet = await readUpload(req);
      const choice = fields.value.schemaType || 'descript';
      const existing = new Set(store.listDataModules(req.ctx.project.id).map((m) => m.dmc));
      res.json({
        sheetName: sheet.sheetName, columns: sheet.columns, skipped: sheet.skipped,
        rows: sheet.rows.map((r) => ({ row: r.row, dmc: r.dmcString, techName: r.techName, infoName: r.infoName, status: r.status, schemaType: dmrl.schemaFor(choice, r.dmc), exists: existing.has(r.dmcString) })),
      });
    }));

  app.post('/api/projects/:id/dmrl/import',
    can('content.write', loaders.project),
    upload(10 * 1024 * 1024),
    content(async (req, res) => {
      const fields = validateObject({ ...DMRL_FIELDS, rows: { type: 'string', max: 20000, pattern: /^\d+(,\d+)*$/ } }, req.body || {});
      if (!fields.ok) return sendError(res, 400, fields.code, fields.error);
      const sheet = await readUpload(req);
      const wanted = fields.value.rows ? new Set(fields.value.rows.split(',').map(Number)) : null;
      const dir = dirOf(req);
      const created = [], duplicates = [];
      for (const r of sheet.rows) {
        if (wanted && !wanted.has(r.row)) continue;
        if (store.findLiveDataModule(req.ctx.project.id, r.dmcString)) { duplicates.push({ row: r.row, dmc: r.dmcString }); continue; }
        // The sheet carries no security, language or issue data: the original's defaults apply.
        const xml = renderShell({ ...NEW_DM_DEFAULTS, schemaType: dmrl.schemaFor(fields.value.schemaType || 'descript', r.dmc), dmc: r.dmc, techName: r.techName || 'Untitled', infoName: r.infoName, brex: projectBrex(dir), date: now() });
        const { dm } = await createModule(req, xml, 'Created from DMRL import');
        created.push(dmOut(dm));
      }
      auditContent(req, 'dmrl.imported', { targetType: 'project', targetId: req.ctx.project.id, meta: { created: created.length, duplicates: duplicates.length, skipped: sheet.skipped.length } });
      res.json({ ok: true, created, duplicates, skipped: sheet.skipped });
    }));
}

module.exports = { register };
