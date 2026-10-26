'use strict';
// Forgot-password queue: neutral responses, routing to the right approver,
// approval issues a temporary password, scope of decisions.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, adminClient, makeUser } = require('./helpers');

let t, admin, pm, pm2, author, adminMade;
test.before(async () => {
  t = await startServer();
  admin = await adminClient(t);
  pm = await makeUser(t, admin, { username: 'mgr.a', role: 'project_manager' });
  pm2 = await makeUser(t, admin, { username: 'mgr.b', role: 'project_manager' });
  author = await makeUser(t, pm, { username: 'auth.a', role: 'author' });
  adminMade = await makeUser(t, admin, { username: 'auth.b', role: 'author' });
});
test.after(() => t.stop());

test('forgot password always answers with the same neutral 202', async () => {
  const c = t.client();
  const a = await c.post('/api/auth/forgot', { username: 'auth.a' });
  const b = await c.post('/api/auth/forgot', { username: 'no-such-user' });
  const d = await c.post('/api/auth/forgot', { username: 'auth.a' }); // duplicate
  assert.equal(a.status, 202);
  assert.deepEqual(a.body, b.body);
  assert.deepEqual(a.body, d.body);
  assert.equal(t.store.listPendingResets().length, 1, 'one pending request per account');
});

test('an Author\'s request goes to the manager who created them; others to the administrator', async () => {
  await t.client().post('/api/auth/forgot', { username: 'auth.b' });
  await t.client().post('/api/auth/forgot', { username: 'mgr.b' });
  const mine = await pm.get('/api/resets');
  assert.deepEqual(mine.body.requests.map((r) => r.user.username), ['auth.a']);
  assert.equal((await pm2.get('/api/resets')).body.requests.length, 0);
  const all = await admin.get('/api/resets');
  const byUser = Object.fromEntries(all.body.requests.map((r) => [r.user.username, r.approver.username]));
  assert.deepEqual(byUser, { 'auth.a': 'mgr.a', 'auth.b': 'admin', 'mgr.b': 'admin' });
  assert.equal((await author.get('/api/resets')).status, 403);
});

test('the request notifies its approver', async () => {
  const n = await pm.get('/api/notifications');
  assert.ok(n.body.notifications.some((x) => x.kind === 'reset' && /auth\.a/.test(x.body)));
});

test('another manager cannot decide a request; the assigned manager approves with a temporary password', async () => {
  const id = (await pm.get('/api/resets')).body.requests[0].id;
  assert.equal((await pm2.post(`/api/resets/${id}/approve`)).status, 404);
  assert.equal((await author.post(`/api/resets/${id}/approve`)).status, 403);
  const r = await pm.post(`/api/resets/${id}/approve`);
  assert.equal(r.status, 200);
  assert.match(r.body.tempPassword, /^auth\.a@\d{4}$/);
  assert.equal((await pm.post(`/api/resets/${id}/approve`)).status, 404, 'a decided request is gone');
  assert.equal((await author.get('/api/auth/me')).status, 401, 'old sessions revoked');
  const c = t.client();
  const l = await c.post('/api/auth/login', { username: 'auth.a', password: r.body.tempPassword });
  assert.equal(l.body.gates.mustChangePassword, true);
});

test('the administrator can reject, and can decide a request assigned to someone else', async () => {
  const reqs = (await admin.get('/api/resets')).body.requests;
  const forB = reqs.find((r) => r.user.username === 'auth.b');
  assert.equal((await admin.post(`/api/resets/${forB.id}/reject`)).status, 200);
  await t.client().post('/api/auth/forgot', { username: 'auth.a' });
  const forA = (await admin.get('/api/resets')).body.requests.find((r) => r.user.username === 'auth.a');
  assert.equal(forA.assignedToMe, false);
  assert.equal((await admin.post(`/api/resets/${forA.id}/approve`)).status, 200);
  const meta = t.store.db.prepare("SELECT meta FROM audit_log WHERE action = 'reset.approved' ORDER BY id DESC").get().meta;
  assert.equal(JSON.parse(meta).override, true, 'an administrator decision on another approver\'s request is marked');
});

test('the administrator\'s own forgot-password request is not queued', async () => {
  const r = await t.client().post('/api/auth/forgot', { username: 'admin' });
  assert.equal(r.status, 202);
  assert.ok(!(await admin.get('/api/resets')).body.requests.some((x) => x.user.username === 'admin'));
  assert.ok(t.store.db.prepare("SELECT 1 FROM audit_log WHERE action = 'reset.requested.admin'").get());
});

test('a disabled account\'s request is silently dropped', async () => {
  await admin.post(`/api/users/${adminMade.user.id}/disable`);
  const r = await t.client().post('/api/auth/forgot', { username: 'auth.b' });
  assert.equal(r.status, 202);
  assert.ok(!(await admin.get('/api/resets')).body.requests.some((x) => x.user.username === 'auth.b'));
});
