'use strict';
// One read-only dashboard per role. Each route is guarded by its own action,
// so a cross-role request is a 403 and returns no data.

const policy = require('../auth/policy');
const fs = require('node:fs');
const path = require('node:path');
const pmc = require('../../vendor/engine/pmc');
const { projectOut, memberOut } = require('./projects');
const { requestOut } = require('./requests');

const { ADMIN, MANAGER, AUTHOR } = policy.ROLES;
const DAY_MS = 24 * 60 * 60 * 1000;

function register({ app, store, authz, now, documents }) {
  const { can } = authz;

  app.get('/api/dashboard/admin',
    can('dashboard.admin'),
    (req, res) => {
      const at = now();
      const byRole = { [ADMIN]: { active: 0, disabled: 0, pending: 0 }, [MANAGER]: { active: 0, disabled: 0, pending: 0 }, [AUTHOR]: { active: 0, disabled: 0, pending: 0 } };
      for (const r of store.countUsersByRole()) {
        byRole[r.role] = { active: Number(r.active), disabled: Number(r.disabled), pending: Number(r.pending) };
      }

      // Sign-in activity for the last 14 UTC days, every day present.
      const days = 14;
      const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()) - (days - 1) * DAY_MS);
      const rows = new Map(store.signInSeries(start.toISOString()).map((r) => [r.day, r]));
      const signIns = [];
      for (let i = 0; i < days; i++) {
        const day = new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10);
        const r = rows.get(day);
        signIns.push({ day, ok: r ? Number(r.ok) : 0, failed: r ? Number(r.failed) : 0 });
      }

      const allProjects = store.listProjects();
      res.json({
        users: byRole,
        ownership: {
          byManagers: allProjects.filter((p) => p.owner_role === MANAGER).length,
          byAuthors: allProjects.filter((p) => p.owner_role === AUTHOR).length,
        },
        totals: {
          users: Object.values(byRole).reduce((n, r) => n + r.active + r.disabled, 0),
          projects: store.countProjects(),
          activeSessions: store.countActiveSessions(at.toISOString()),
          pendingResets: store.listPendingResets().length,
        },
        signIns,
        projects: allProjects.slice(0, 8).map(projectOut),
        recentActivity: store.listRecentAudit(8).map((a) => ({
          id: a.id, at: a.at, actor: a.actor_username, action: a.action,
          targetType: a.target_type, projectId: a.project_id, meta: a.meta ? JSON.parse(a.meta) : null,
        })),
        // Phase 3: every request, by status, and the latest ones (oversight; the override is Phase 4).
        submissions: (() => {
          const all = store.listRequests({ pendingFirst: true, limit: 1000 });
          const byStatus = { pending: 0, approved: 0, rejected: 0, changes_requested: 0, withdrawn: 0, stale: 0 };
          for (const r of all) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
          return { byStatus, total: all.length, recent: all.slice(0, 6).map((r) => requestOut(r)) };
        })(),
      });
    });

  /*
    Team activity (decisions.md M8), for the projects the manager owns only:
    per Author and item (a data module, the publication, a graphic), the last
    action and when, the module's status, and whether the Author has an
    unsaved draft of it and since when (never the draft itself).
  */
  const ACTION_LABEL = {
    'dm.created': 'created', 'dm.imported': 'imported', 'dm.saved': 'saved', 'dm.renamed': 'renamed', 'dm.deleted': 'deleted', 'dm.restored': 'restored',
    'publication.saved': 'saved', 'publication.imported': 'imported', 'publication.built': 'built the PDF', 'graphic.uploaded': 'uploaded',
    'request.submitted': 'submitted for approval', 'request.withdrawn': 'withdrew the request',
  };
  function teamActivity(projects) {
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

  app.get('/api/dashboard/manager',
    can('dashboard.manager'),
    (req, res) => {
      const me = req.auth.user;
      const projects = store.listProjects({ ownerId: me.id }).map((p) => ({
        ...projectOut(p),
        authors: store.listMembers(p.id).map(memberOut),
      }));
      const assigned = new Set(projects.flatMap((p) => p.authors.map((a) => a.id)));
      const requests = store.listRequests({ managerId: me.id, pendingFirst: true, limit: 200 });
      res.json({
        projects,
        totals: {
          projects: projects.length,
          assignedAuthors: assigned.size,
          authorsCreated: store.countCreatedBy(me.id),
          pendingResets: store.listPendingResets({ approverId: me.id }).length,
          pendingRequests: requests.filter((r) => r.status === 'pending').length,
        },
        pendingRequests: requests.filter((r) => r.status === 'pending').slice(0, 10).map((r) => requestOut(r)),
        teamActivity: teamActivity(projects),
      });
    });

  /*
    The Author dashboard (checkpoint 2b): projects; data modules by status
    and the ones they last worked on; each project's publication (entries,
    last build, request); the last validation per project; drafts; requests.
    Everything is limited to projects the Author owns or is assigned to.
  */
  app.get('/api/dashboard/author',
    can('dashboard.author'),
    (req, res) => {
      const me = req.auth.user;
      const rows = store.listProjects({ userId: me.id });
      const projects = rows.map(projectOut);
      const byStatus = { draft: 0, in_review: 0, approved: 0 };
      const recent = [];
      const publications = [];
      const validation = [];
      const requests = store.listRequests({ submittedBy: me.id, limit: 50 });
      for (const p of rows) {
        const mods = store.listDataModules(p.id);
        for (const m of mods) {
          byStatus[m.status] = (byStatus[m.status] || 0) + 1;
          if (m.updated_by === me.id || m.created_by === me.id) recent.push({ id: m.id, projectId: p.id, projectName: p.name, dmc: m.dmc, techName: m.tech_name, infoName: m.info_name, status: m.status, updatedAt: m.updated_at });
        }
        let counts = null;
        try { counts = pmc.countEntries(pmc.parsePm(fs.readFileSync(path.join(documents.workspaceFor(p), 'publication.xml'), 'utf8')).entries); } catch { counts = null; }
        const b = store.lastBuild(p.id, 'full');
        const latest = requests.find((r) => r.project_id === p.id) || null;
        publications.push({
          projectId: p.id, projectName: p.name, entries: counts,
          lastBuild: b ? { ok: !!b.ok, at: b.at, ms: b.ms } : null,
          request: latest ? { id: latest.id, status: latest.status, submittedAt: latest.submitted_at, manager: latest.manager_name } : null,
        });
        const v = store.lastValidation(p.id);
        validation.push({ projectId: p.id, projectName: p.name, modules: mods.length, run: v ? { errors: v.errors, warnings: v.warnings, at: v.at } : null });
      }
      recent.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      const drafts = store.listDraftsForUser(me.id).filter((d) => rows.some((p) => p.id === d.project_id));
      const validated = validation.filter((v) => v.run);
      res.json({
        projects,
        totals: {
          projects: projects.length,
          owned: projects.filter((p) => p.relation === 'owner').length,
          assigned: projects.filter((p) => p.relation === 'assigned').length,
          dataModules: Object.values(byStatus).reduce((a, b) => a + b, 0),
          publications: publications.filter((x) => x.entries && x.entries.dms > 0).length,
          validationErrors: validated.reduce((n, v) => n + v.run.errors, 0),
          validationWarnings: validated.reduce((n, v) => n + v.run.warnings, 0),
          unvalidated: validation.length - validated.length,
          pendingRequests: requests.filter((r) => r.status === 'pending').length,
        },
        dataModules: { byStatus, recent: recent.slice(0, 8) },
        publications,
        validation,
        drafts: drafts.slice(0, 10).map((d) => ({ key: d.doc_key, projectId: d.project_id, projectName: d.project_name, updatedAt: d.updated_at, size: d.size })),
        requests: requests.slice(0, 10).map(requestOut),
      });
    });
}

module.exports = { register };
