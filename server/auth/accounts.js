'use strict';
// Account helpers shared by the auth, users and reset-queue routes: the
// public shape of a user, and the single path that issues a temporary
// password. Nothing here returns or logs a hash.

const { hashPassword } = require('./crypto');
const policy = require('./policy');

function accountStatus(u) {
  if (u.disabled_at) return 'disabled';
  if (u.onboarding_pending) return 'pending';
  return 'active';
}

function tempPasswordState(u, now) {
  if (!u.temp_password_expires_at) return null;
  return {
    expiresAt: u.temp_password_expires_at,
    used: !!u.temp_password_used_at,
    expired: Date.parse(u.temp_password_expires_at) <= now.getTime(),
  };
}

function publicUser(u, now = new Date()) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    role: u.role,
    status: accountStatus(u),
    onboardingPending: !!u.onboarding_pending,
    mustChangePassword: !!u.must_change_password,
    disabledAt: u.disabled_at || null,
    lastLoginAt: u.last_login_at || null,
    createdAt: u.created_at,
    createdBy: u.created_by
      ? { id: u.created_by, username: u.created_by_username || null, fullName: u.created_by_name || null }
      : null,
    tempPassword: tempPasswordState(u, now),
    projectCount: u.project_count != null ? Number(u.project_count) : undefined,
    ownedCount: u.owned_count != null ? Number(u.owned_count) : undefined,
  };
}

const gatesOf = (u) => ({
  onboarding: !!u.onboarding_pending,
  mustChangePassword: !u.onboarding_pending && !!u.must_change_password,
});

/*
  Who decides a forgot-password request for this account: the Project
  Manager who created an Author, while that manager is active and still a
  Project Manager; otherwise the Software Administrator. decisions.md A10.
*/
function resolveResetApprover(store, user) {
  if (user.role === policy.ROLES.AUTHOR && user.created_by) {
    const creator = store.getUser(user.created_by);
    if (creator && creator.role === policy.ROLES.MANAGER && !creator.disabled_at) return creator.id;
  }
  const admin = store.getAdmin();
  return admin ? admin.id : null;
}

/*
  Default approver for an Author's publication request (decisions.md W1):
  the Project Manager who created the Author, while that account is an
  active Project Manager. Otherwise null, and the Author must choose one.
  The Author may always choose a different active Project Manager.
*/
function defaultApproverFor(store, author) {
  if (!author || !author.created_by) return null;
  const creator = store.getUser(author.created_by);
  return creator && creator.role === policy.ROLES.MANAGER && !creator.disabled_at ? creator.id : null;
}

/*
  THE path that issues (or reissues) a temporary password. username@year,
  valid 24 h, single use, every session revoked. An account that has not
  finished onboarding goes back through onboarding; any other account gets
  the forced-change gate. The value is returned to the caller exactly once
  and is never audited or logged. decisions.md S1.
*/
async function issueTempPassword({ store, audit, target, actor, ip, reason, now }) {
  const at = now();
  const tempPassword = policy.tempPasswordFor(target.username, at);
  const expiresAt = new Date(at.getTime() + policy.TEMP_PASSWORD_TTL_MS).toISOString();
  const hash = await hashPassword(tempPassword);
  const lifecycle = target.onboarding_pending ? 'onboarding' : 'forced-change';
  store.updateUser(target.id, {
    password_hash: hash,
    onboarding_pending: target.onboarding_pending ? 1 : 0,
    must_change_password: target.onboarding_pending ? 0 : 1,
    temp_password_expires_at: expiresAt,
    temp_password_used_at: null,
  }, at.toISOString());
  const revoked = store.revokeAllSessionsForUser(target.id, 'temp-password-issued', at.toISOString());
  audit({
    actorId: actor.id, actorUsername: actor.username, ip,
    action: 'user.temp_password_issued', targetType: 'user', targetId: target.id,
    meta: { username: target.username, reason, lifecycle, sessionsRevoked: revoked, expiresAt },
  });
  return { tempPassword, expiresAt };
}

module.exports = { publicUser, gatesOf, accountStatus, resolveResetApprover, defaultApproverFor, issueTempPassword };
