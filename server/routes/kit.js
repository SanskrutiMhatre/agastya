'use strict';
/*
  Helpers shared by the content route modules (publication builder,
  requests, drafts): the signed-in user, the workspace directory, content
  auditing that also announces the change on the event hub, and the handler
  wrapper that turns ContentError and BuildError into their status and code.
  Nothing here makes an authorization decision; every route still has its
  own guard.
*/

const { handle } = require('../http/errors');
const { ContentError } = require('../content/xmlcheck');
const pdf = require('../publish/pdf');
const { LockedError } = require('../content/locks');

function createKit({ audit, events, documents, clientIp, now }) {
  const me = (req) => req.auth.user;
  const nowIso = () => now().toISOString();
  const dirOf = (req) => documents.workspaceFor(req.ctx.project);

  function auditContent(req, action, extra = {}) {
    const projectId = extra.projectId || req.ctx.project.id;
    audit({ actorId: me(req).id, actorUsername: me(req).username, ip: clientIp(req), projectId, ...extra, action });
    events.emit('content', {
      projectId, action, docId: extra.targetId || null,
      revision: (extra.meta && extra.meta.revision) || null, by: me(req).fullName, byId: me(req).id, at: nowIso(),
    });
  }

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

  return { me, nowIso, dirOf, auditContent, content };
}

module.exports = { createKit };
