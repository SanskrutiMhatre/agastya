'use strict';
/*
  Autosaved drafts (checkpoint 2b). While an Author edits, the editor saves
  the unsaved text here every few seconds; on return it offers to restore it.
  A draft is private to the user who wrote it, is never built, validated or
  part of a request's sources, and is deleted when the real save succeeds or
  the user discards it. Only the Authors who write the project keep drafts in
  it (draft.write); the administrator, even when overriding, keeps none.

    GET    /api/projects/:id/drafts/:key   the caller's draft, or 404
    PUT    /api/projects/:id/drafts/:key   { content, baseRevision }
    DELETE /api/projects/:id/drafts/:key
    GET    /api/drafts/mine                the caller's drafts, newest first (no content)

  key: dm-<data module id> | publication | publication-tree. A data module key
  must name a live module of this project.
*/

const { loaders } = require('../auth/authz');
const { body } = require('../http/validate');
const { sendError } = require('../http/errors');
const { createKit } = require('./kit');

const KEY = /^(dm-[0-9a-f-]{36}|publication|publication-tree)$/;
const MAX_DRAFT = 8 * 1024 * 1024;

function register(ctx) {
  const { app, store, authz } = ctx;
  const { can, requireAuth } = authz;
  const { me, nowIso } = createKit(ctx);

  // The key must be well formed and, for a module, name one in this project.
  function keyOk(req, res) {
    const key = req.params.key;
    if (!KEY.test(key)) { sendError(res, 404, 'NOT_FOUND', 'Not found.'); return null; }
    if (key.startsWith('dm-')) {
      const dm = store.getDataModule(key.slice(3));
      if (!dm || dm.project_id !== req.ctx.project.id || dm.deleted_at) { sendError(res, 404, 'NOT_FOUND', 'Not found.'); return null; }
    }
    return key;
  }

  const draftOut = (d) => ({ key: d.doc_key, projectId: d.project_id, projectName: d.project_name || null, baseRevision: d.base_revision, size: d.size, updatedAt: d.updated_at });

  app.get('/api/projects/:id/drafts/:key',
    can('draft.write', loaders.project),
    (req, res) => {
      const key = keyOk(req, res); if (!key) return;
      const d = store.getDraft(me(req).id, req.ctx.project.id, key);
      if (!d) return sendError(res, 404, 'NOT_FOUND', 'No draft.');
      res.json({ draft: { ...draftOut(d), content: d.content } });
    });

  app.put('/api/projects/:id/drafts/:key',
    can('draft.write', loaders.project),
    body({ content: { type: 'password', required: true, max: MAX_DRAFT }, baseRevision: { type: 'integer', min: 1 } }),
    (req, res) => {
      const key = keyOk(req, res); if (!key) return;
      if (Buffer.byteLength(req.valid.content, 'utf8') > MAX_DRAFT) return sendError(res, 413, 'TOO_LARGE', 'The draft is larger than 8 MB.');
      if (req.valid.content.includes('\0')) return sendError(res, 400, 'VALIDATION', 'The draft contains NUL characters.');
      store.putDraft({ userId: me(req).id, projectId: req.ctx.project.id, docKey: key, baseRevision: req.valid.baseRevision, content: req.valid.content, now: nowIso() });
      res.json({ ok: true, savedAt: nowIso() });
    });

  app.delete('/api/projects/:id/drafts/:key',
    can('draft.write', loaders.project),
    (req, res) => {
      const key = keyOk(req, res); if (!key) return;
      store.deleteDraft(me(req).id, req.ctx.project.id, key);
      res.json({ ok: true });
    });

  app.get('/api/drafts/mine',
    requireAuth(),
    (req, res) => {
      // Only drafts in projects the caller can still write to.
      const list = store.listDraftsForUser(me(req).id).filter((d) => {
        const project = store.getProject(d.project_id);
        const v = authz.evaluate(me(req), 'draft.write', { project, membership: project ? store.getMembership(project.id, me(req).id) : null });
        return v.ok;
      });
      const withNames = list.map((d) => {
        const out = draftOut(d);
        if (d.doc_key.startsWith('dm-')) {
          const dm = store.getDataModule(d.doc_key.slice(3));
          out.title = dm ? `${dm.tech_name}${dm.info_name ? ` – ${dm.info_name}` : ''}` : 'Data module';
          out.dmc = dm ? dm.dmc : null;
          out.link = dm ? `/projects/${d.project_id}/dms/${dm.id}` : null;
        } else {
          out.title = d.doc_key === 'publication' ? 'Publication module (XML)' : 'Publication module (builder)';
          out.link = `/projects/${d.project_id}?tab=publication`;
        }
        return out;
      });
      res.json({ drafts: withNames });
    });
}

module.exports = { register };
