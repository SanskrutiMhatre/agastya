'use strict';
/*
  The publication module builder (checkpoint 2b), after the Agastya
  original's routes/pmc.ts, on our write path:

    GET  /api/projects/:id/publication/model   tree + counts + unplaced pool + revision
    PUT  /api/projects/:id/publication/model   save the tree (?allowEmpty=1 to clear)
    POST /api/projects/:id/publication/import  replace with an uploaded PM, stored verbatim
    GET  /api/projects/:id/publication/ietm-form   dmRef form download
    GET  /api/projects/:id/publication/pdf-form    xi:include form download

  Saves and imports go through documents.writeDocument: the XML safety
  guard (including XInclude containment), well-formedness, path containment,
  revision-based conflict detection (409) and an immutable revision.
*/

const path = require('node:path');
const pmc = require('../../vendor/engine/pmc');
const { loaders } = require('../auth/authz');
const { body, query } = require('../http/validate');
const { sendError } = require('../http/errors');
const { assertWritableXml, ContentError } = require('../content/xmlcheck');
const { resolveDmRefs } = require('../../vendor/engine/resolveDmRefs');
const pub = require('../content/publication');
const { createKit } = require('./kit');

const PM_REL = 'publication.xml';

function register(ctx) {
  const { app, store, authz, documents, locks } = ctx;
  const { can } = authz;
  const { me, dirOf, auditContent, content } = createKit(ctx);

  const readPm = (req) => {
    const doc = documents.ensureDocument(req.ctx.project, PM_REL, 'pm');
    return { doc, ...documents.readDocument(req.ctx.project, doc) };
  };
  const modulesOf = (req) => store.listDataModules(req.ctx.project.id);
  const unresolvedIn = (req, xml) => (resolveDmRefs(xml, path.join(dirOf(req), 'csdb'), 'csdb').unresolved || []).map((u) => ({ code: u.code, title: u.title || '' }));

  function parseOr400(xml) {
    try { return pmc.parsePm(xml); } catch { throw new ContentError(400, 'NOT_A_PUBLICATION_MODULE', 'The XML must be an S1000D publication module with a <pm> root element.'); }
  }

  app.get('/api/projects/:id/publication/model',
    can('content.read', loaders.project),
    content(async (req, res) => {
      const { content: xml, head } = readPm(req);
      let model;
      try { model = pub.readModel(dirOf(req), xml, modulesOf(req)); } catch {
        return sendError(res, 422, 'PM_UNREADABLE', 'publication.xml cannot be read as a publication module. Correct it in the XML view.');
      }
      res.json({ ...model, revision: head.id, revisionAt: head.created_at, revisionBy: head.created_by_name || null, lock: locks.lockOf(req.ctx.project.id, PM_REL) });
    }));

  app.put('/api/projects/:id/publication/model',
    can('content.write', loaders.project),
    query({ allowEmpty: { type: 'string', enum: ['0', '1'] } }),
    body({ entries: { type: 'array', required: true, max: pub.MAX_ENTRIES }, baseRevision: { type: 'integer', required: true, min: 1 } }),
    content(async (req, res) => {
      locks.assertUnlocked(me(req), req.ctx.project.id, PM_REL);
      let entries;
      try { entries = pub.validateEntries(req.valid.entries); } catch (e) {
        if (e instanceof pub.EntryError) return sendError(res, 400, 'VALIDATION', e.message);
        throw e;
      }
      const counts = pmc.countEntries(entries);
      if (counts.total === 0 && req.validQuery.allowEmpty !== '1') {
        return sendError(res, 400, 'EMPTY_PUBLICATION', 'Refusing to save an empty publication: it has no chapters or data module entries. Save again with "allow empty" if that is intended.');
      }
      const { doc, content: current } = readPm(req);
      let next;
      try { next = pub.applyEntries(current, entries); } catch (e) {
        if (e instanceof pub.EntryError) return sendError(res, 422, 'PM_UNREADABLE', e.message);
        throw e;
      }
      // The original's guard: what is written must read back as the same tree.
      if (!pub.roundTrip(next, entries)) {
        return sendError(res, 500, 'ROUND_TRIP_FAILED', 'Internal check failed: the publication would not read back identically. Nothing was written.');
      }
      await assertWritableXml(next);
      const { revision } = await documents.writeDocument({
        project: req.ctx.project, doc, content: next, baseRevision: req.valid.baseRevision, userId: me(req).id, reason: 'Saved from the publication builder',
      });
      const unresolved = unresolvedIn(req, next);
      store.deleteDraft(me(req).id, req.ctx.project.id, 'publication-tree');
      auditContent(req, 'publication.saved', { targetType: 'project', targetId: req.ctx.project.id, meta: { revision: revision.id, entries: counts.total, unresolved: unresolved.length, via: 'builder' } });
      res.json({ ok: true, revision: revision.id, counts, unresolved, model: pub.readModel(dirOf(req), next, modulesOf(req)) });
    }));

  app.post('/api/projects/:id/publication/import',
    can('content.write', loaders.project),
    body({ xml: { type: 'password', required: true, max: 8 * 1024 * 1024 }, baseRevision: { type: 'integer', required: true, min: 1 } }),
    content(async (req, res) => {
      const xml = req.valid.xml.replace(/^﻿/, '');
      if (!/<pm[\s>]/.test(xml) || /<dmodule[\s>]/.test(xml)) {
        return sendError(res, 400, 'NOT_A_PUBLICATION_MODULE', 'The file must be an S1000D publication module (<pm>).');
      }
      locks.assertUnlocked(me(req), req.ctx.project.id, PM_REL);
      // Checked before anything is written: a refused upload leaves the publication as it was.
      await assertWritableXml(xml);
      const model = parseOr400(xml);
      const counts = pmc.countEntries(model.entries);
      if (counts.total === 0) return sendError(res, 400, 'EMPTY_PUBLICATION', 'That publication module contains no entries.');
      const { doc } = readPm(req);
      // Stored verbatim, as in the original: a hand-maintained file is not reformatted.
      const { revision } = await documents.writeDocument({
        project: req.ctx.project, doc, content: xml, baseRevision: req.valid.baseRevision, userId: me(req).id, reason: 'Imported publication module',
      });
      const unresolved = unresolvedIn(req, xml);
      auditContent(req, 'publication.imported', { targetType: 'project', targetId: req.ctx.project.id, meta: { revision: revision.id, entries: counts.total, unresolved: unresolved.length } });
      res.json({ ok: true, revision: revision.id, counts, warnings: model.warnings.slice(0, 50), unresolved });
    }));

  const download = (form) => content(async (req, res) => {
    const { content: xml } = readPm(req);
    parseOr400(xml);
    const out = form === 'ietm' ? pub.ietmForm(dirOf(req), xml) : pub.pdfForm(dirOf(req), xml);
    const safeName = (req.ctx.project.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) || 'publication');
    res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename="PMC-${form === 'ietm' ? 'IETM' : 'PDF'}-${safeName}.xml"` });
    res.send(out);
  });
  app.get('/api/projects/:id/publication/ietm-form', can('content.read', loaders.project), download('ietm'));
  app.get('/api/projects/:id/publication/pdf-form', can('content.read', loaders.project), download('pdf'));
}

module.exports = { register };
