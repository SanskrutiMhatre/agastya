'use strict';
/*
  The Software Administrator's overrides (decisions.md V1-V8). Every
  override, whatever its kind, is recorded twice in the same step:

    admin_overrides   the permanent record with the written reason (append-only)
    audit_log         one 'admin.override' row: kind, the underlying action,
                      the reason, and the people to tell (the notifier reads
                      them from here, like every other notification)

  The underlying action (request.decided, dm.saved, project.member.added, ...)
  is audited as well, carrying `overrideId`, so feeds, the stale check and
  the dashboards keep working unchanged.

    kind       who is told
    decision   the submitting Author and the manager the request was sent to
    reset      the same
    reassign   the submitter, the previous manager and the new one
    content    the project's owner and Authors, and the manager of each pending
               request; once per editing session (its first save)
    members    the Author added or removed, and the project's owner
*/

const crypto = require('node:crypto');

function createOverrides({ store, audit, now, clientIp }) {
  const nowIso = () => now().toISOString();

  function record(req, { kind, action, projectId = null, requestId = null, targetType = null, targetId = null, reason, sessionId = null, recipients = [], meta = {} }) {
    const admin = req.auth.user;
    const id = crypto.randomUUID();
    const text = String(reason).trim();
    store.addOverride({ id, at: nowIso(), adminId: admin.id, kind, action, projectId, requestId, targetType, targetId, sessionId, reason: text });
    const to = [...new Set(recipients)].filter((u) => u && u !== admin.id);
    audit({
      actorId: admin.id, actorUsername: admin.username, ip: clientIp(req), projectId,
      action: 'admin.override', targetType: targetType || (requestId ? 'request' : null), targetId: targetId || requestId,
      meta: { overrideId: id, kind, action, reason: text, requestId, sessionId, adminName: admin.fullName, recipients: to, ...meta },
    });
    return id;
  }

  // Who hears about a content override in this project: its owner and Authors, and pending requests' managers.
  function contentRecipients(project) {
    const out = [project.owner_id, ...store.listMembers(project.id).map((m) => m.user_id)];
    for (const r of store.listPendingRequestsForProject(project.id)) out.push(r.assigned_manager_id);
    return out;
  }

  /*
    One save (or create, delete, upload, ...) under an override session.
    Notifies only on the session's first save; every save is recorded.
  */
  function recordContent(req, { action, projectId, targetType, targetId, label }) {
    const { session } = req.ctx.override;
    const project = req.ctx.project;
    const first = Number(session.saves) === 0;
    store.touchOverrideSession(session.id, nowIso());
    session.saves = Number(session.saves) + 1;
    return record(req, {
      kind: 'content', action, projectId, targetType, targetId, reason: session.reason, sessionId: session.id,
      recipients: first ? contentRecipients(project) : [], meta: { projectName: project.name, target: label || null, firstInSession: first || undefined },
    });
  }

  return { record, recordContent, contentRecipients };
}

module.exports = { createOverrides };
