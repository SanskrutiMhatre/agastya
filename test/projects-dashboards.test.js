'use strict';
// Projects, ownership, assignment scope, and one dashboard per role.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, adminClient, makeUser } = require('./helpers');
const { defaultApproverFor } = require('../server/auth/accounts');

let t, admin, pm, pm2, a1, a2, a3, project, own;
test.before(async () => {
  t = await startServer();
  admin = await adminClient(t);
  pm = await makeUser(t, admin, { username: 'lead.one', role: 'project_manager' });
  pm2 = await makeUser(t, admin, { username: 'lead.two', role: 'project_manager' });
  a1 = await makeUser(t, pm, { username: 'tech.one', role: 'author' });
  a2 = await makeUser(t, admin, { username: 'tech.two', role: 'author' });
  a3 = await makeUser(t, pm2, { username: 'tech.three', role: 'author' });
});
test.after(() => t.stop());

test('Project Managers and Authors create projects; the administrator does not; names are unique', async () => {
  assert.equal((await admin.post('/api/projects', { name: 'Radar Manual' })).status, 403);
  const r = await pm.post('/api/projects', { name: 'Radar Manual', description: 'RDR-A maintenance' });
  assert.equal(r.status, 201);
  assert.match(r.body.project.id, /^prj-[0-9a-f]{10}$/);
  assert.equal(r.body.project.owner.id, pm.user.id);
  assert.equal(r.body.project.owner.role, 'project_manager');
  project = r.body.project;
  assert.equal((await pm2.post('/api/projects', { name: 'radar manual' })).body.code, 'NAME_TAKEN');

  const o = await a1.post('/api/projects', { name: 'Field Notes', description: 'An Author-owned project' });
  assert.equal(o.status, 201);
  assert.equal(o.body.project.owner.id, a1.user.id, 'the creating Author owns it');
  assert.equal(o.body.project.owner.role, 'author');
  own = o.body.project;
});

test('the owning Project Manager assigns and removes Authors; other managers cannot', async () => {
  const cand = await pm.get(`/api/projects/${project.id}/assignable`);
  assert.deepEqual(cand.body.authors.map((x) => x.username).sort(), ['tech.one', 'tech.three', 'tech.two']);
  assert.equal((await pm2.post(`/api/projects/${project.id}/members`, { userId: a1.user.id })).status, 404);
  assert.equal((await pm.post(`/api/projects/${project.id}/members`, { userId: pm2.user.id })).body.code, 'NOT_AN_AUTHOR');
  assert.equal((await pm.post(`/api/projects/${project.id}/members`, { userId: a1.user.id })).status, 201);
  assert.equal((await pm.post(`/api/projects/${project.id}/members`, { userId: a1.user.id })).body.code, 'ALREADY_ASSIGNED');
  assert.equal((await pm.post(`/api/projects/${project.id}/members`, { userId: a2.user.id })).status, 201);
  assert.equal((await a1.post(`/api/projects/${project.id}/members`, { userId: a2.user.id })).status, 403);
  assert.equal((await pm.del(`/api/projects/${project.id}/members/${a2.user.id}`)).status, 200);
  const n = await a2.get('/api/notifications');
  assert.ok(n.body.notifications.some((x) => x.title === 'Removed from Radar Manual'));
});

test('the owning Author adds and removes existing Authors; assigned Authors and managers cannot (R12)', async () => {
  const d = await a1.get(`/api/projects/${own.id}`);
  assert.equal(d.body.permissions.assign, true);
  assert.equal(d.body.relation, 'owner');
  assert.equal((await a1.post(`/api/projects/${own.id}/members`, { userId: pm.user.id })).body.code, 'NOT_AN_AUTHOR', 'members are Authors only');
  assert.equal((await a1.post(`/api/projects/${own.id}/members`, { userId: a2.user.id })).status, 201);
  // a2 is now a member but cannot manage members.
  assert.equal((await a2.post(`/api/projects/${own.id}/members`, { userId: a3.user.id })).status, 403);
  assert.equal((await a2.get(`/api/projects/${own.id}/assignable`)).status, 403);
  // The Author's creating manager cannot see, let alone change, the project.
  assert.equal((await pm.post(`/api/projects/${own.id}/members`, { userId: a3.user.id })).status, 404);
  assert.equal((await a1.del(`/api/projects/${own.id}/members/${a2.user.id}`)).status, 200);
  assert.equal((await a2.get(`/api/projects/${own.id}`)).status, 404);
  assert.equal((await a1.post('/api/users', { username: 'not.allowed', fullName: 'N A', role: 'author' })).status, 403, 'Authors still cannot create accounts');
});

test('the administrator can add and remove members, audited as an administrator action', async () => {
  const cand = (await admin.get(`/api/projects/${own.id}/assignable`)).body.authors.map((x) => x.username);
  assert.ok(!cand.includes('tech.one'), 'the owner is not offered as a member');
  assert.equal((await admin.post(`/api/projects/${own.id}/members`, { userId: a1.user.id })).body.code, 'ALREADY_OWNER');
  assert.equal((await admin.post(`/api/projects/${own.id}/members`, { userId: a3.user.id })).status, 201);
  const meta = JSON.parse(t.store.db.prepare("SELECT meta FROM audit_log WHERE action = 'project.member.added' ORDER BY id DESC").get().meta);
  assert.equal(meta.byAdmin, true);
  assert.equal((await a3.get(`/api/projects/${own.id}`)).status, 200, 'the assigned Author now sees it');
  assert.equal((await admin.del(`/api/projects/${own.id}/members/${a3.user.id}`)).status, 200);
  assert.equal((await a3.get(`/api/projects/${own.id}`)).status, 404);
});

test('visibility: owner, assigned Authors and the administrator only; everyone else 404', async () => {
  assert.equal((await a2.get(`/api/projects/${project.id}`)).status, 404);
  assert.equal((await pm2.get(`/api/projects/${project.id}`)).status, 404);
  assert.equal((await a2.get('/api/projects/prj-0000000000')).status, 404);
  assert.equal((await a1.get(`/api/projects/${project.id}`)).body.relation, 'assigned');
  assert.equal((await admin.get(`/api/projects/${project.id}`)).status, 200);
  // An Author-owned project is invisible to every Project Manager, including the Author's creator.
  assert.equal((await pm.get(`/api/projects/${own.id}`)).status, 404);
  assert.equal((await pm2.get(`/api/projects/${own.id}`)).status, 404);
  assert.equal((await a2.get(`/api/projects/${own.id}`)).status, 404);
  assert.deepEqual((await a2.get('/api/projects')).body.projects, []);
  const mine = (await a1.get('/api/projects')).body.projects;
  assert.deepEqual(mine.map((p) => [p.name, p.relation]).sort(), [['Field Notes', 'owner'], ['Radar Manual', 'assigned']]);
  assert.deepEqual((await pm.get('/api/projects')).body.projects.map((p) => p.name), ['Radar Manual']);
  assert.equal((await admin.get('/api/projects')).body.projects.length, 2);
});

test('every role sees only its own dashboard', async () => {
  const cases = [
    [admin, '/api/dashboard/admin'],
    [pm, '/api/dashboard/manager'],
    [a1, '/api/dashboard/author'],
  ];
  for (const [who, own_] of cases) {
    for (const [, url] of cases) {
      const r = await who.get(url);
      assert.equal(r.status, url === own_ ? 200 : 403, `${url}`);
      if (url !== own_) assert.equal(r.body.code, 'FORBIDDEN');
    }
  }
  for (const [, url] of cases) assert.equal((await t.client().get(url)).status, 401, `${url} unauthenticated`);
});

test('administrator dashboard: users by role, projects by owner type, sessions, activity', async () => {
  const d = (await admin.get('/api/dashboard/admin')).body;
  assert.equal(d.users.software_admin.active, 1);
  assert.equal(d.users.project_manager.active, 2);
  assert.equal(d.users.author.active, 3);
  assert.equal(d.totals.projects, 2);
  assert.deepEqual(d.ownership, { byManagers: 1, byAuthors: 1 });
  assert.ok(d.totals.activeSessions >= 4);
  assert.equal(d.signIns.length, 14);
  assert.ok(d.recentActivity.length > 0);
  assert.equal(d.submissions.total, 0, 'Phase 3: real figures, no requests yet');
  assert.equal(d.submissions.byStatus.pending, 0);
});

test('Project Manager dashboard lists the projects they own with assigned Authors', async () => {
  const d = (await pm.get('/api/dashboard/manager')).body;
  assert.deepEqual(d.projects.map((p) => p.name), ['Radar Manual']);
  assert.deepEqual(d.projects[0].authors.map((a) => a.username), ['tech.one']);
  assert.equal(d.totals.assignedAuthors, 1);
  assert.deepEqual(d.pendingRequests, []);
  assert.deepEqual(d.teamActivity.items, []);
  assert.equal((await pm2.get('/api/dashboard/manager')).body.projects.length, 0, 'scope isolation');
});

test('Author dashboard lists owned and assigned projects, marked as such', async () => {
  const d = (await a1.get('/api/dashboard/author')).body;
  assert.deepEqual(d.projects.map((p) => [p.name, p.relation]).sort(), [['Field Notes', 'owner'], ['Radar Manual', 'assigned']]);
  assert.equal(d.totals.projects, 2);
  assert.equal(d.totals.owned, 1);
  assert.equal(d.totals.assigned, 1);
  // Checkpoint 2b: real figures, no placeholders.
  assert.deepEqual(d.dataModules.byStatus, { draft: 0, in_review: 0, approved: 0 });
  assert.equal(d.publications.length, 2);
  assert.deepEqual(d.requests, []);
  assert.equal(d.totals.unvalidated, 2);
  assert.equal((await a2.get('/api/dashboard/author')).body.projects.length, 0);
});

test('a Project Manager who owns projects cannot be demoted', async () => {
  assert.equal((await admin.patch(`/api/users/${pm.user.id}`, { role: 'author' })).body.code, 'HAS_DEPENDENTS');
});

test('approval routing default: the Author\'s creating Project Manager, else none', async () => {
  assert.equal(defaultApproverFor(t.store, t.store.getUser(a1.user.id)), pm.user.id);
  assert.equal(defaultApproverFor(t.store, t.store.getUser(a3.user.id)), pm2.user.id);
  assert.equal(defaultApproverFor(t.store, t.store.getUser(a2.user.id)), null, 'created by the administrator: the Author must choose');
  await admin.post(`/api/users/${pm2.user.id}/disable`);
  assert.equal(defaultApproverFor(t.store, t.store.getUser(a3.user.id)), null, 'a disabled creator is not a default');
  await admin.post(`/api/users/${pm2.user.id}/enable`);
});
