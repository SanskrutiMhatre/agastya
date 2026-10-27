'use strict';
/*
  Who is working on what (decisions.md M8, V1): per Author and item (a data
  module, the publication, a graphic), the last action and when, the
  module's status, and whether the Author has an unsaved draft of it and
  since when (never the draft itself). `projects` carry their Authors
  (`authors`). The manager dashboard passes the projects the manager owns;
  the administrator's oversight passes every project.
*/

const ACTION_LABEL = {
  'dm.created': 'created', 'dm.imported': 'imported', 'dm.saved': 'saved', 'dm.renamed': 'renamed', 'dm.deleted': 'deleted', 'dm.restored': 'restored',
  'publication.saved': 'saved', 'publication.imported': 'imported', 'publication.built': 'built the PDF', 'graphic.uploaded': 'uploaded',
  'request.submitted': 'submitted for approval', 'request.withdrawn': 'withdrew the request',
};
function teamActivity(store, projects) {
  const ids = projects.map((p) => p.id);
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const drafts = store.listDraftsForProjects(ids);
  const draftOf = (userId, projectId, key) => drafts.find((d) => d.user_id === userId && d.project_id === projectId && d.doc_key === key) || null;
  const seen = new Set();
  const items = [];
  for (const a of store.listContentActivity(ids)) {
    if (a.actor_role !== 'author' || !ACTION_LABEL[a.action]) continue;
    let meta = null;
    try { meta = a.meta ? JSON.parse(a.meta) : null; } catch { meta = null; }
    let target, key, draftKey;
    if (a.action.startsWith('dm.')) {
      const dm = store.getDataModule(a.target_id);
      if (!dm) continue;
      target = { type: 'dm', id: dm.id, label: `${dm.tech_name}${dm.info_name ? ` – ${dm.info_name}` : ''}`, dmc: dm.dmc, status: dm.deleted_at ? 'deleted' : dm.status };
      key = `dm:${dm.id}`; draftKey = `dm-${dm.id}`;
    } else if (a.action.startsWith('graphic.')) {
      target = { type: 'graphic', id: a.target_id, label: (meta && meta.icn) || a.target_id };
      key = `g:${a.target_id}`;
    } else {
      target = { type: 'publication', id: a.project_id, label: 'Publication' };
      key = 'pub'; draftKey = 'publication-tree';
    }
    const k = `${a.actor_id}|${a.project_id}|${key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const d = draftKey ? (draftOf(a.actor_id, a.project_id, draftKey) || (key === 'pub' ? draftOf(a.actor_id, a.project_id, 'publication') : null)) : null;
    items.push({
      author: { id: a.actor_id, name: a.actor_name }, project: { id: a.project_id, name: names.get(a.project_id) },
      target, action: ACTION_LABEL[a.action], at: a.at, draftSince: d ? d.updated_at : null,
    });
    if (items.length >= 60) break;
  }
  // Drafts with no audited action yet (work started, never saved).
  for (const d of drafts) {
    const u = store.getUser(d.user_id);
    if (!u || u.role !== 'author') continue;
    const dmId = d.doc_key.startsWith('dm-') ? d.doc_key.slice(3) : null;
    const k = `${d.user_id}|${d.project_id}|${dmId ? `dm:${dmId}` : 'pub'}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const dm = dmId ? store.getDataModule(dmId) : null;
    items.push({
      author: { id: u.id, name: u.full_name }, project: { id: d.project_id, name: names.get(d.project_id) },
      target: dm ? { type: 'dm', id: dm.id, label: `${dm.tech_name}${dm.info_name ? ` – ${dm.info_name}` : ''}`, dmc: dm.dmc, status: dm.status } : { type: 'publication', id: d.project_id, label: 'Publication' },
      action: 'editing (unsaved)', at: d.updated_at, draftSince: d.updated_at,
    });
  }
  items.sort((x, y) => String(y.at).localeCompare(String(x.at)));
  // Every Author on the manager's projects, with their last activity (or none yet).
  const authors = new Map();
  for (const p of projects) for (const a of p.authors) if (!authors.has(a.id)) authors.set(a.id, { id: a.id, name: a.fullName || a.name, projects: [], lastAt: null, items: 0, drafts: 0 });
  for (const p of projects) for (const a of p.authors) authors.get(a.id).projects.push(p.name);
  for (const it of items) {
    const a = authors.get(it.author.id);
    if (!a) continue;
    a.items++;
    if (it.draftSince) a.drafts++;
    if (!a.lastAt || it.at > a.lastAt) a.lastAt = it.at;
  }
  return { items: items.slice(0, 60), authors: [...authors.values()].sort((x, y) => String(y.lastAt || '').localeCompare(String(x.lastAt || ''))) };
}

module.exports = { teamActivity, ACTION_LABEL };
