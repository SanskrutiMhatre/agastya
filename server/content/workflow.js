'use strict';
/*
  The data module status flow (decisions.md M3). Status moves only here, and
  only through the approval flow:

    request event        modules frozen in that request become
    submitted            in_review
    approved             approved
    rejected             draft
    changes_requested    draft
    withdrawn            draft
    stale                draft

    and saving a module that is `approved` makes it `draft` again, so
    "approved" always means the text that was approved.

  A module frozen in several requests follows the newest one: an event of an
  older request does not move it.
*/

const fs = require('node:fs');
const { snapshotFile } = require('./requests');

const STATUSES = ['draft', 'in_review', 'approved'];
const TRANSITIONS = {
  submitted: 'in_review',
  approved: 'approved',
  rejected: 'draft',
  changes_requested: 'draft',
  withdrawn: 'draft',
  stale: 'draft',
};

/*
  The modules a request froze: recorded at submission (Phase 3), or for an
  older request derived from its snapshot manifest and the live records.
*/
function modulesOf(store, dataDir, request) {
  const rows = store.listRequestModules(request.id);
  if (rows.length) return rows.map((r) => ({ id: r.data_module_id, rel_path: r.rel_path }));
  let rels = [];
  try { rels = JSON.parse(fs.readFileSync(snapshotFile(dataDir, request, 'manifest.json'), 'utf8')).files.map((f) => f.rel); } catch { rels = []; }
  const live = store.listDataModules(request.project_id);
  return live.filter((m) => rels.includes(m.rel_path)).map((m) => ({ id: m.id, rel_path: m.rel_path }));
}

// Apply a request event to the modules it froze. Returns [{ id, from, to }] for the ones that moved.
function applyRequestEvent(store, dataDir, request, event) {
  const to = TRANSITIONS[event];
  if (!to) throw new Error(`workflow: unknown event ${event}`);
  const moved = [];
  for (const m of modulesOf(store, dataDir, request)) {
    const newest = store.newestRequestForModule(m.id);
    if (newest && newest.id !== request.id) continue; // a newer request governs it
    const dm = store.getDataModule(m.id);
    if (!dm || dm.deleted_at || dm.status === to) continue;
    store.setDataModuleStatus(m.id, to);
    moved.push({ id: m.id, from: dm.status, to });
  }
  return moved;
}

// After an Author's save: an approved module is a draft again. Returns true when it moved.
function afterSave(store, dm) {
  if (dm.status !== 'approved') return false;
  store.setDataModuleStatus(dm.id, 'draft');
  return true;
}

module.exports = { STATUSES, TRANSITIONS, modulesOf, applyRequestEvent, afterSave };
