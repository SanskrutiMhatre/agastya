'use strict';
/*
  Helpers shared by every content route module (content, publication
  builder, requests, drafts): the signed-in user, the workspace directory,
  content auditing that also announces the change on the event hub, and the
  handler wrapper that turns ContentError, LockedError and BuildError into
  their status and code. Nothing here makes an authorization decision; every
  route still has its own guard.

  A write made by the administrator under an override session
  (req.ctx.override, decisions.md V3) is recorded as an admin override with
  the session's reason before the change itself is audited, and the change
  event carries the override so the stale check can name it (V5).
*/

const { handle } = require('../http/errors');
const { ContentError } = require('../content/xmlcheck');
const pdf = require('../publish/pdf');
const { LockedError } = require('../content/locks');

function createKit({ audit, events, documents, clientIp, now, overrides }) {
  const me = (req) => req.auth.user;
  const nowIso = () => now().toISOString();
  const dirOf = (req) => documents.workspaceFor(req.ctx.project);
  const overrideOf = (req) => (req.ctx && req.ctx.override && req.ctx.override.ok ? req.ctx.override : null);

  function auditContent(req, action, extra = {}) {
    const projectId = extra.projectId || req.ctx.project.id;
    const ov = overrideOf(req);
    let overrideId = null;
    if (ov) {
      overrideId = overrides.recordContent(req, {
        action, projectId, targetType: extra.targetType || null, targetId: extra.targetId || null,
        label: (extra.meta && (extra.meta.dmc || extra.meta.icn)) || null,
      });
    }
    const meta = ov ? { ...(extra.meta || {}), overrideId } : extra.meta;
    audit({ actorId: me(req).id, actorUsername: me(req).username, ip: clientIp(req), projectId, ...extra, meta, action });
    events.emit('content', {
      projectId, action, docId: extra.targetId || null,
      revision: (extra.meta && extra.meta.revision) || null, by: me(req).fullName, byId: me(req).id, at: nowIso(),
      override: ov ? { id: overrideId, reason: ov.session.reason } : null,
    });
  }

  // The lock check for a write (decisions.md L1), with the administrator's acknowledgement when overriding (V5).
  const unlockOpts = (req) => ({ acceptStale: !!(overrideOf(req) && overrideOf(req).acceptStale) });

  const content = (fn) => handle(async (req, res, next) => {
    try { await fn(req, res, next); } catch (e) {
      if (e instanceof ContentError) {
        return res.status(e.status).json({ error: e.message, code: e.code, line: e.line, conflict: e.conflict });
      }
      if (e instanceof LockedError) return res.status(e.status).json({ error: e.message, code: e.code, lock: e.lock });
      if (e instanceof pdf.BuildError) {
        return res.status(422).json({ error: `The PDF build failed: ${e.message}`, code: e.code, hint: e.hint, file: e.file, line: e.line });
      }
      throw e;
    }
  });

  return { me, nowIso, dirOf, auditContent, content, unlockOpts, overrideOf };
}

module.exports = { createKit };
