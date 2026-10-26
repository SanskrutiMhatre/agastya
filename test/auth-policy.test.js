'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../server/auth/policy');
const { hashPassword, verifyPassword, scryptHash, sha256hex, newToken } = require('../server/auth/crypto');

test('password policy: 8 to 128 characters', () => {
  assert.equal(policy.validatePassword('Ab3$efg').ok, false);
  assert.equal(policy.validatePassword('Ab3$efgh').ok, true);
  assert.equal(policy.validatePassword('x'.repeat(128)).ok, true);
  assert.equal(policy.validatePassword('x'.repeat(129)).ok, false);
  assert.equal(policy.validatePassword('').ok, false);
  assert.equal(policy.validatePassword(undefined).ok, false);
});

test('password policy: common passwords are refused case-insensitively', () => {
  for (const p of ['password', 'PassWord123', 'qwertyuiop', 'Agastya@123', 'changeme']) {
    assert.equal(policy.validatePassword(p).ok, false, p);
  }
});

test('a chosen password may not keep the temporary username@year shape', () => {
  assert.equal(policy.validateNewPassword('ravi.k@2027', 'ravi.k').ok, false);
  assert.equal(policy.validateNewPassword('RAVI.K@1999', 'ravi.k').ok, false);
  assert.equal(policy.validateNewPassword('ravi.k@2027-extra', 'ravi.k').ok, true);
  assert.equal(policy.validateNewPassword('Kestrel-Quay-55', 'ravi.k').ok, true);
});

test('usernames: lowercase, 3 to 32 characters, reserved names refused', () => {
  assert.deepEqual(policy.validateUsername('  Ravi.K '), { ok: true, username: 'ravi.k' });
  assert.equal(policy.validateUsername('ab').ok, false);
  assert.equal(policy.validateUsername('a'.repeat(33)).ok, false);
  assert.equal(policy.validateUsername('-ravi').ok, false);
  assert.equal(policy.validateUsername('ravi kumar').ok, false);
  assert.equal(policy.validateUsername('ravi/../x').ok, false);
  for (const r of ['admin', 'root', 'system', 'administrator', 'agastya']) {
    assert.equal(policy.validateUsername(r).ok, false, r);
  }
  assert.equal(policy.validateUsername('admin', { allowReserved: true }).ok, true);
});

test('temporary password is username@year with the year at issue time', () => {
  assert.equal(policy.tempPasswordFor('ravi', new Date('2026-03-01T10:00:00Z')), 'ravi@2026');
  assert.equal(policy.tempPasswordFor('Ravi.K', new Date('2027-06-01T10:00:00Z')), 'ravi.k@2027');
  assert.equal(policy.TEMP_PASSWORD_TTL_MS, 24 * 60 * 60 * 1000);
});

test('exactly three roles exist', () => {
  assert.deepEqual([...policy.ALL_ROLES].sort(), ['author', 'project_manager', 'software_admin']);
});

test('hashes are PHC strings and verify; scrypt fallback verifies too', async () => {
  const h = await hashPassword('Kestrel-Quay-55');
  assert.match(h, /^\$(argon2id|scrypt)\$/);
  assert.equal(await verifyPassword(h, 'Kestrel-Quay-55'), true);
  assert.equal(await verifyPassword(h, 'Kestrel-Quay-56'), false);
  const s = scryptHash('Kestrel-Quay-55');
  assert.match(s, /^\$scrypt\$N=\d+,r=8,p=1\$/);
  assert.equal(await verifyPassword(s, 'Kestrel-Quay-55'), true);
  assert.equal(await verifyPassword(s, 'nope-nope-nope'), false);
  assert.equal(await verifyPassword('plaintext', 'plaintext'), false, 'a non-PHC value never verifies');
});

test('session tokens are 256-bit and only their SHA-256 is stored', () => {
  const t = newToken();
  assert.equal(Buffer.from(t, 'base64url').length, 32);
  assert.match(sha256hex(t), /^[0-9a-f]{64}$/);
});
