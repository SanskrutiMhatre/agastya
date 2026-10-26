'use strict';
// Creation hierarchy, scope, role changes, resets and their audit trail.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, adminClient, makeUser } = require('./helpers');

let t, admin, pm, pm2, author;
test.before(async () => {
  t = await startServer();
  admin = await adminClient(t);
  pm = await makeUser(t, admin, { username: 'pm.one', role: 'project_manager' });
  pm2 = await makeUser(t, admin, { username: 'pm.two', role: 'project_manager' });
  author = await makeUser(t, pm, { username: 'writer.one', role: 'author' });
});
test.after(() => t.stop());

const actions = () => t.store.db.prepare('SELECT action, target_id, meta FROM audit_log ORDER BY id').all();

test('an Author cannot create anyone', async () => {
  for (const role of ['author', 'project_manager', 'software_admin']) {
    const r = await author.post('/api/users', { username: `x-${role.slice(0, 4)}`, fullName: 'X Y', role });
    assert.equal(r.status, 403, role);
  }
  assert.equal((await author.get('/api/users')).status, 403);
});

test('a Project Manager can create Authors but not Project Managers or administrators', async () => {
  assert.equal((await pm.post('/api/users', { username: 'pm.three', fullName: 'P Three', role: 'project_manager' })).body.code, 'ROLE_NOT_ALLOWED');
  assert.equal((await pm.post('/api/users', { username: 'boss', fullName: 'B Oss', role: 'software_admin' })).body.code, 'ROLE_NOT_ALLOWED');
  const ok = await pm.post('/api/users', { username: 'writer.two', fullName: 'Writer Two', role: 'author' });
  assert.equal(ok.status, 201);
  assert.equal(t.store.getUser(ok.body.user.id).created_by, pm.user.id, 'created_by recorded');
});

test('only one Software Administrator can ever exist', async () => {
  assert.equal((await admin.post('/api/users', { username: 'admin2', fullName: 'Admin Two', role: 'software_admin' })).body.code, 'ROLE_NOT_ALLOWED');
  assert.equal((await admin.patch(`/api/users/${pm2.user.id}`, { role: 'software_admin' })).body.code, 'ROLE_NOT_ALLOWED');
  assert.equal(t.store.listUsers({ role: 'software_admin' }).length, 1);
});

test('usernames: reserved, malformed and duplicate names are refused', async () => {
  assert.equal((await admin.post('/api/users', { username: 'root', fullName: 'R', role: 'author' })).status, 400);
  assert.equal((await admin.post('/api/users', { username: 'a b', fullName: 'R', role: 'author' })).status, 400);
  assert.equal((await admin.post('/api/users', { username: 'WRITER.ONE', fullName: 'R', role: 'author' })).body.code, 'USERNAME_TAKEN');
});

test('a Project Manager sees and manages only the Authors they created', async () => {
  const mine = await pm.get('/api/users');
  assert.ok(mine.body.users.every((u) => u.role === 'author' && u.createdBy.id === pm.user.id));
  assert.ok(mine.body.users.some((u) => u.username === 'writer.one'));
  const theirs = await pm2.get('/api/users');
  assert.ok(!theirs.body.users.some((u) => u.username === 'writer.one'));
  // Outside scope is 404, not 403: the account is not disclosed.
  assert.equal((await pm2.get(`/api/users/${author.user.id}`)).status, 404);
  assert.equal((await pm2.post(`/api/users/${author.user.id}/reset`)).status, 404);
  assert.equal((await pm2.patch(`/api/users/${author.user.id}`, { fullName: 'Hijack' })).status, 404);
  assert.equal((await pm.get(`/api/users/${pm2.user.id}`)).status, 404);
  assert.equal((await pm.get('/api/users/does-not-exist')).status, 404);
  const detail = await pm.get(`/api/users/${author.user.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.permissions.reset, true);
  assert.equal(detail.body.permissions.disable, true, 'a manager disables the Authors they created (M7)');
  assert.equal(detail.body.sessions, undefined, 'session details are administrator-only');
});

test('a Project Manager resets, disables and enables only Authors they created', async () => {
  const r = await pm.post(`/api/users/${author.user.id}/reset`);
  assert.equal(r.status, 200);
  assert.match(r.body.tempPassword, /^writer\.one@\d{4}$/);
  assert.equal((await pm2.post(`/api/users/${author.user.id}/disable`)).status, 404, 'not their Author');
  assert.equal((await pm.post(`/api/users/${pm2.user.id}/disable`)).status, 404, 'not an Author of theirs');
  assert.equal((await pm.post(`/api/users/${author.user.id}/disable`)).status, 200);
  assert.equal((await pm.post(`/api/users/${author.user.id}/enable`)).status, 200);
  assert.equal((await pm.post(`/api/users/${pm.user.id}/reset`)).status, 404);
  // Restore the author for later tests.
  const c = t.client();
  await c.post('/api/auth/login', { username: 'writer.one', password: r.body.tempPassword });
  assert.equal((await c.post('/api/auth/change-password', { newPassword: author.password + '-2' })).status, 200);
  author.cookie = c.cookie;
  author.password += '-2';
});

test('nobody changes their own role; role changes are administrator-only and audited', async () => {
  assert.equal((await pm.patch(`/api/users/${pm.user.id}`, { role: 'author' })).status, 404);
  assert.equal((await author.patch(`/api/users/${author.user.id}`, { role: 'project_manager' })).status, 403);
  const adminId = t.store.getAdmin().id;
  assert.equal((await admin.patch(`/api/users/${adminId}`, { role: 'author' })).body.code, 'ROLE_NOT_ALLOWED');
  assert.equal((await pm.patch(`/api/users/${author.user.id}`, { role: 'project_manager' })).body.code, 'ROLE_NOT_ALLOWED');

  const w = await admin.post('/api/users', { username: 'promote.me', fullName: 'Promote Me', role: 'author' });
  const p = await admin.patch(`/api/users/${w.body.user.id}`, { role: 'project_manager' });
  assert.equal(p.status, 200);
  assert.equal(p.body.user.role, 'project_manager');
  const entry = actions().find((a) => a.action === 'user.role.changed' && a.target_id === w.body.user.id);
  assert.deepEqual(JSON.parse(entry.meta).to, 'project_manager');
  // A manager with Authors cannot be demoted until they are reassigned.
  assert.equal((await admin.patch(`/api/users/${pm.user.id}`, { role: 'author' })).body.code, 'HAS_DEPENDENTS');
});

test('the Software Administrator cannot be disabled or reset through the API', async () => {
  const adminId = t.store.getAdmin().id;
  assert.equal((await admin.post(`/api/users/${adminId}/disable`)).status, 403);
  assert.equal((await admin.post(`/api/users/${adminId}/reset`)).body.code, 'SELF_NOT_ALLOWED');
});

test('the administrator can revoke a user\'s sessions', async () => {
  const a = await makeUser(t, admin, { username: 'sess.user', role: 'author' });
  const d = await admin.get(`/api/users/${a.user.id}`);
  assert.equal(d.body.sessions.length, 1);
  assert.equal((await admin.post(`/api/sessions/${d.body.sessions[0].id}/revoke`)).status, 200);
  assert.equal((await a.get('/api/auth/me')).status, 401);
  assert.equal((await pm.post(`/api/users/${a.user.id}/sessions/revoke`)).status, 403);
});

test('account creation, disabling, resets and role changes are all audited without secrets', async () => {
  const seen = new Set(actions().map((a) => a.action));
  for (const a of ['user.created', 'user.temp_password_issued', 'user.role.changed', 'auth.session.revoked', 'auth.login', 'auth.onboarding.completed']) {
    assert.ok(seen.has(a), `missing audit action ${a}`);
  }
  const all = JSON.stringify(t.store.db.prepare('SELECT * FROM audit_log').all());
  assert.ok(!/[a-z0-9._-]+@\d{4}/.test(all), 'no username@year temporary password anywhere in the audit log');
  assert.ok(!/\$argon2|\$scrypt/.test(all), 'no hashes in the audit log');
});
