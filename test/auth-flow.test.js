'use strict';
// Sign-in, account gates, sessions and the temporary-password limits, over real HTTP.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, adminClient, makeUser, ADMIN } = require('./helpers');

let offset = 0;
const now = () => new Date(Date.now() + offset);
let t;
test.before(async () => { t = await startServer({ now }); });
test.after(() => t.stop());

test('bootstrap creates exactly one administrator behind a forced change', async () => {
  const c = t.client();
  const r = await c.post('/api/auth/login', { username: ADMIN.username, password: ADMIN.bootstrap });
  assert.equal(r.status, 200);
  assert.equal(r.body.gates.mustChangePassword, true);
  assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Max-Age=1800/, 'gated session is capped at 30 minutes');
  // The gate blocks everything but its own exit.
  assert.equal((await c.get('/api/users')).body.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await c.get('/api/dashboard/admin')).status, 403);
  assert.equal((await c.get('/api/auth/me')).status, 200);
  // Policy still applies to the new password.
  assert.equal((await c.post('/api/auth/change-password', { newPassword: 'password123' })).body.code, 'PASSWORD_POLICY');
  const ch = await c.post('/api/auth/change-password', { newPassword: ADMIN.password });
  assert.equal(ch.status, 200);
  assert.match(ch.headers.get('set-cookie'), /Max-Age=604800/, 'a full 7-day session after the gate closes');
  assert.equal((await c.get('/api/dashboard/admin')).status, 200);
  assert.equal(t.store.listUsers({ role: 'software_admin' }).length, 1);
});

test('bootstrap is a no-op once an administrator exists', async () => {
  const { ensureBootstrapAdmin } = require('../server/auth/bootstrap');
  const r = await ensureBootstrapAdmin({ store: t.store, audit: () => {}, env: { AGASTYA_INITIAL_ADMIN_USERNAME: 'second', AGASTYA_INITIAL_ADMIN_PASSWORD: 'Another-Long-Pass-1' }, log: () => {} });
  assert.deepEqual(r, { created: false, reason: 'admin-exists' });
  assert.equal(t.store.findUserByUsername('second'), null);
});

test('unknown user and wrong password fail identically', async () => {
  const c = t.client();
  const a = await c.post('/api/auth/login', { username: 'nobody-here', password: 'Whatever-123' });
  const b = await c.post('/api/auth/login', { username: ADMIN.username, password: 'Wrong-Password-1' });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.deepEqual(a.body, b.body);
  assert.equal(a.headers.get('set-cookie'), null);
});

test('session cookie: HttpOnly, SameSite=Lax, opaque; only the hash is stored', async () => {
  const admin = await adminClient(t);
  const token = admin.cookie.split('=')[1];
  const rows = t.store.db.prepare('SELECT token_hash FROM sessions').all().map((r) => r.token_hash);
  assert.ok(!rows.includes(token), 'raw token is not stored');
  assert.ok(rows.includes(require('../server/auth/crypto').sha256hex(token)));
});

test('a new sign-in displaces the previous session; sign-out revokes', async () => {
  const a = await adminClient(t);
  const b = await adminClient(t);
  assert.equal((await a.get('/api/auth/me')).status, 401, 'older session displaced');
  assert.equal((await b.get('/api/auth/me')).status, 200);
  assert.equal((await b.post('/api/auth/logout')).status, 200);
  const stale = b.cookie;
  b.cookie = stale;
  assert.equal((await b.get('/api/auth/me')).status, 401);
});

test('new account: username@year temporary password, onboarding, then a fresh session', async () => {
  const admin = await adminClient(t);
  const r = await admin.post('/api/users', { username: 'ravi', fullName: 'Ravi Kumar', role: 'project_manager' });
  assert.equal(r.status, 201);
  assert.equal(r.body.tempPassword, `ravi@${now().getFullYear()}`);
  const ttl = Date.parse(r.body.tempPasswordExpiresAt) - now().getTime();
  assert.ok(ttl > 23.9 * 3600e3 && ttl <= 24 * 3600e3, '24-hour expiry');

  const c = t.client();
  const l = await c.post('/api/auth/login', { username: 'ravi', password: r.body.tempPassword });
  assert.equal(l.status, 200);
  assert.equal(l.body.gates.onboarding, true);
  assert.equal((await c.get('/api/dashboard/manager')).body.code, 'ONBOARDING_REQUIRED');
  assert.equal((await c.post('/api/auth/change-password', { newPassword: 'Kestrel-Quay-55' })).body.code, 'ONBOARDING_REQUIRED',
    'the forced-change exit does not open the onboarding gate');
  // A new password in the temporary shape is refused.
  assert.equal((await c.post('/api/auth/onboarding', { fullName: 'Ravi Kumar', newPassword: `ravi@${now().getFullYear() + 1}` })).body.code, 'PASSWORD_POLICY');
  const before = c.cookie;
  const o = await c.post('/api/auth/onboarding', { fullName: 'Ravi K. Kumar', newPassword: 'Kestrel-Quay-55' });
  assert.equal(o.status, 200);
  assert.notEqual(c.cookie, before, 'new session at the authentication boundary');
  assert.equal(o.body.user.fullName, 'Ravi K. Kumar');
  assert.equal((await c.get('/api/dashboard/manager')).status, 200);
  assert.equal((await c.post('/api/auth/onboarding', { fullName: 'X', newPassword: 'Kestrel-Quay-56' })).status, 409);
});

test('temporary password works for the first sign-in only', async () => {
  const admin = await adminClient(t);
  const r = await admin.post('/api/users', { username: 'once', fullName: 'Once Only', role: 'author' });
  const first = t.client();
  assert.equal((await first.post('/api/auth/login', { username: 'once', password: r.body.tempPassword })).status, 200);
  await first.post('/api/auth/logout');
  const second = await t.client().post('/api/auth/login', { username: 'once', password: r.body.tempPassword });
  assert.equal(second.status, 401);
  assert.equal(second.body.code, 'TEMP_PASSWORD_USED');
});

test('temporary password expires after 24 hours; a reissue restores access', async () => {
  const admin = await adminClient(t);
  const r = await admin.post('/api/users', { username: 'late', fullName: 'Late Starter', role: 'author' });
  offset = 24 * 3600e3 + 1000;
  try {
    const l = await t.client().post('/api/auth/login', { username: 'late', password: r.body.tempPassword });
    assert.equal(l.status, 401);
    assert.equal(l.body.code, 'TEMP_PASSWORD_EXPIRED');
    const admin2 = await adminClient(t);
    const re = await admin2.post(`/api/users/${r.body.user.id}/reset`);
    assert.equal(re.status, 200);
    const ok = await t.client().post('/api/auth/login', { username: 'late', password: re.body.tempPassword });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.gates.onboarding, true, 'never onboarded: back through onboarding');
  } finally { offset = 0; }
});

test('reset of an onboarded account forces a password change and revokes sessions', async () => {
  const admin = await adminClient(t);
  const pm = await makeUser(t, admin, { username: 'meera', role: 'project_manager' });
  const re = await admin.post(`/api/users/${pm.user.id}/reset`);
  assert.equal(re.status, 200);
  assert.equal((await pm.get('/api/auth/me')).status, 401, 'live session revoked by the reset');
  const c = t.client();
  const l = await c.post('/api/auth/login', { username: 'meera', password: re.body.tempPassword });
  assert.equal(l.body.gates.mustChangePassword, true);
  assert.equal((await c.get('/api/projects')).body.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await c.post('/api/auth/change-password', { newPassword: 'Osprey-Delta-31' })).status, 200);
  assert.equal((await c.get('/api/projects')).status, 200);
});

test('voluntary change requires the current password and a different new one', async () => {
  const admin = await adminClient(t);
  const a = await makeUser(t, admin, { username: 'vol', role: 'author' });
  assert.equal((await a.post('/api/auth/change-password', { currentPassword: 'wrong-wrong-1', newPassword: 'Plover-Ridge-12' })).body.code, 'BAD_CURRENT_PASSWORD');
  assert.equal((await a.post('/api/auth/change-password', { currentPassword: a.password, newPassword: a.password })).body.code, 'PASSWORD_POLICY');
  assert.equal((await a.post('/api/auth/change-password', { currentPassword: a.password, newPassword: 'Plover-Ridge-12' })).status, 200);
  assert.equal((await t.client().post('/api/auth/login', { username: 'vol', password: 'Plover-Ridge-12' })).status, 200);
});

test('a disabled account loses access immediately and cannot sign in', async () => {
  const admin = await adminClient(t);
  const a = await makeUser(t, admin, { username: 'gone', role: 'author' });
  assert.equal((await a.get('/api/dashboard/author')).status, 200);
  assert.equal((await admin.post(`/api/users/${a.user.id}/disable`)).status, 200);
  assert.equal((await a.get('/api/dashboard/author')).status, 401);
  const l = await t.client().post('/api/auth/login', { username: 'gone', password: a.password });
  assert.equal(l.status, 401);
  assert.equal(l.body.code, 'BAD_CREDENTIALS', 'indistinguishable from a wrong password');
  assert.equal((await admin.post(`/api/users/${a.user.id}/enable`)).status, 200);
  assert.equal((await t.client().post('/api/auth/login', { username: 'gone', password: a.password })).status, 200);
});

test('an expired session is refused', async () => {
  const admin = await adminClient(t);
  offset = 7 * 24 * 3600e3 + 1000;
  try {
    assert.equal((await admin.get('/api/auth/me')).status, 401);
  } finally { offset = 0; }
});
