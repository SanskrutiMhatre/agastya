'use strict';
// First-run bootstrap of the single Software Administrator from
// AGASTYA_INITIAL_ADMIN_USERNAME / AGASTYA_INITIAL_ADMIN_PASSWORD.
//
// Idempotent: once an administrator exists this is a logged no-op. The
// configured password must meet the policy and is only ever a temporary
// credential: the account is created behind the forced-change gate, so it
// can do nothing until its owner picks a new password. Neither the password
// nor its hash is ever printed.

const { hashPassword, newId } = require('./crypto');
const policy = require('./policy');

async function ensureBootstrapAdmin({ store, audit, env = process.env, log = console.log, now = () => new Date() }) {
  const username = String(env.AGASTYA_INITIAL_ADMIN_USERNAME || '').trim();
  const password = env.AGASTYA_INITIAL_ADMIN_PASSWORD || '';

  if (store.getAdmin()) {
    log('[bootstrap] Software Administrator already present; bootstrap skipped.');
    return { created: false, reason: 'admin-exists' };
  }
  if (!username || !password) {
    log('[bootstrap] No Software Administrator exists and AGASTYA_INITIAL_ADMIN_USERNAME / AGASTYA_INITIAL_ADMIN_PASSWORD are not set. Nobody can sign in until they are provided.');
    return { created: false, reason: 'env-missing' };
  }
  const u = policy.validateUsername(username, { allowReserved: true });
  if (!u.ok) {
    log(`[bootstrap] AGASTYA_INITIAL_ADMIN_USERNAME rejected: ${u.error}`);
    return { created: false, reason: 'bad-username' };
  }
  const p = policy.validatePassword(password);
  if (!p.ok) {
    log(`[bootstrap] AGASTYA_INITIAL_ADMIN_PASSWORD rejected by the password policy: ${p.error}`);
    return { created: false, reason: 'bad-password' };
  }
  if (store.findUserByUsername(u.username)) {
    log(`[bootstrap] The username "${u.username}" is already taken. Nothing changed.`);
    return { created: false, reason: 'username-taken' };
  }

  const passwordHash = await hashPassword(password);
  const created = store.tx(() => {
    if (store.getAdmin()) return null; // re-checked inside the write lock
    return store.createUser({
      id: newId(),
      username: u.username,
      fullName: 'Software Administrator',
      role: policy.ROLES.ADMIN,
      passwordHash,
      mustChangePassword: 1,
      createdBy: null,
      now: now().toISOString(),
    });
  });
  if (!created) return { created: false, reason: 'admin-exists' };
  audit({ action: 'user.bootstrap_admin_created', targetType: 'user', targetId: created.id, meta: { username: created.username } });
  log(`[bootstrap] Created Software Administrator "${created.username}" (password change required at first sign-in).`);
  return { created: true, userId: created.id };
}

module.exports = { ensureBootstrapAdmin };
