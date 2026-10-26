'use strict';
/*
  THE write path for project text sources (decisions.md C6, PROMPT Phase 2):
  every save, create, import and restore of a data module or the publication
  module goes through writeDocument(). In order:

    1. the XML safety guard and well-formedness (xmlcheck.js);
    2. path containment (workspace.resolveInProject);
    3. revision-based conflict detection: the caller names the revision it
       edited (baseRevision); if the document has moved on since, the write
       is refused with 409 and nothing changes;
    4. an atomic file write (temp file + rename);
    5. a new immutable revision whose content is stored once by SHA-256.

  Steps 3 to 5 run with no await between them, so two saves to the same
  document can never interleave inside this process.

  A file changed on disk by something other than Agastya is noticed on the
  next read and recorded as its own revision, so history and conflict
  detection stay truthful.
*/

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveInProject, ensureWorkspace, writeFileAtomic } = require('./workspace');
const { assertWritableXml, ContentError } = require('./xmlcheck');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function createDocumentService({ store, dataDir, now = () => new Date() }) {
  const nowIso = () => now().toISOString();

  const workspaceFor = (project) => ensureWorkspace(dataDir, project);

  function absFor(project, rel) {
    const abs = resolveInProject(workspaceFor(project), rel);
    if (!abs) throw new ContentError(400, 'BAD_PATH', 'That file path is not allowed.');
    return abs;
  }

  function cutRevision(doc, content, reason, userId) {
    const buf = Buffer.from(content, 'utf8');
    const hash = sha256(buf);
    const at = nowIso();
    store.putBlob(hash, buf, at);
    const rev = store.addRevision({ documentId: doc.id, hash, relPath: doc.rel_path, reason, now: at, userId });
    store.touchDocument(doc.id, at);
    return rev;
  }

  /*
    Current content and head revision. If the file on disk differs from the
    head (edited outside Agastya), that change becomes a revision first.
  */
  function readDocument(project, doc) {
    const abs = absFor(project, doc.rel_path);
    if (!fs.existsSync(abs)) throw new ContentError(404, 'FILE_MISSING', 'The file for this document is missing from the project workspace.');
    const content = fs.readFileSync(abs, 'utf8');
    let head = store.headRevision(doc.id);
    if (!head || head.hash !== sha256(Buffer.from(content, 'utf8'))) {
      head = cutRevision(doc, content, head ? 'Changed outside Agastya' : 'Recorded existing file', null);
    }
    return { content, head };
  }

  /*
    Create or update a document's content.
      existing doc: pass `doc` and `baseRevision` (the revision id the caller edited)
      new doc:      pass `rel` and `kind`; the path must not be taken
    Returns { doc, revision }.
  */
  async function writeDocument({ project, doc = null, rel = null, kind = 'other', content, baseRevision, userId, reason }) {
    await assertWritableXml(content);
    const relPath = doc ? doc.rel_path : rel;
    const abs = absFor(project, relPath);

    // ---- no await below this line: check, write and record are one step ----
    if (doc) {
      const head = store.headRevision(doc.id);
      const onDisk = fs.existsSync(abs) ? sha256(fs.readFileSync(abs)) : null;
      const changedOutside = head && onDisk && onDisk !== head.hash;
      if (!head || changedOutside || Number(baseRevision) !== head.id) {
        const current = changedOutside ? cutRevision(doc, fs.readFileSync(abs, 'utf8'), 'Changed outside Agastya', null) : head;
        throw new ContentError(409, 'CONFLICT', 'This document was changed since you opened it. Copy your work, reload, and apply your changes again.', {
          conflict: {
            yourBase: Number(baseRevision) || null,
            current: current ? current.id : null,
            updatedBy: current ? (current.created_by_name || current.created_by_username || 'outside Agastya') : null,
            updatedAt: current ? current.created_at : null,
          },
        });
      }
      writeFileAtomic(abs, content);
      return { doc, revision: cutRevision(doc, content, reason || 'Saved', userId) };
    }

    if (fs.existsSync(abs) || store.findLiveDocument(project.id, relPath)) {
      throw new ContentError(409, 'PATH_TAKEN', 'A file with that name already exists in the project.');
    }
    const created = store.createDocument({ id: crypto.randomUUID(), projectId: project.id, relPath, kind, now: nowIso() });
    writeFileAtomic(abs, content);
    return { doc: created, revision: cutRevision(created, content, reason || 'Created', userId) };
  }

  // The document record for a file that already exists in the workspace
  // (the publication module, scaffolded on disk), created on first use.
  function ensureDocument(project, rel, kind) {
    const existing = store.findLiveDocument(project.id, rel);
    if (existing) return existing;
    absFor(project, rel);
    return store.createDocument({ id: crypto.randomUUID(), projectId: project.id, relPath: rel, kind, now: nowIso() });
  }

  // Move a document's file (soft delete, restore, or a DMC rename). History follows the document.
  function moveDocument(project, doc, newRel, { deleted = null } = {}) {
    const from = absFor(project, doc.rel_path);
    const to = absFor(project, newRel);
    if (fs.existsSync(to)) throw new ContentError(409, 'PATH_TAKEN', 'A file with that name already exists in the project.');
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (fs.existsSync(from)) fs.renameSync(from, to);
    store.moveDocument(doc.id, newRel, nowIso());
    store.setDocumentDeleted(doc.id, deleted, nowIso());
    return store.getDocument(doc.id);
  }

  // The content of one revision, re-hashed on read: a mismatch is refused, never served.
  function revisionContent(rev) {
    const blob = store.getBlob(rev.hash);
    if (!blob) throw new ContentError(500, 'INTEGRITY', 'This revision\'s content is missing.');
    const buf = Buffer.from(blob.content);
    if (sha256(buf) !== rev.hash) throw new ContentError(500, 'INTEGRITY', 'This revision failed its integrity check.');
    return buf.toString('utf8');
  }

  return { workspaceFor, absFor, readDocument, writeDocument, moveDocument, revisionContent, cutRevision, ensureDocument };
}

module.exports = { createDocumentService, sha256 };
