'use strict';
// The one password policy, the username rules and the temporary-password
// scheme. Every path that accepts or issues a password goes through here, so
// the rules cannot drift apart between flows.

const ROLES = Object.freeze({
  ADMIN: 'software_admin',
  MANAGER: 'project_manager',
  AUTHOR: 'author',
});
const ALL_ROLES = Object.freeze([ROLES.ADMIN, ROLES.MANAGER, ROLES.AUTHOR]);

// Compact denylist of passwords people actually type. Lowercase; matched
// case-insensitively.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234',
  'qwertyui', 'qwerty123', 'qwerty12', '1q2w3e4r', '1qaz2wsx', 'qwer1234', 'asdfghjk', 'asdf1234',
  'iloveyou', 'sunshine', 'princess', 'football', 'baseball', 'superman', 'welcome1', 'welcome123',
  'admin123', 'root1234', 'letmein1', 'whatever', 'trustno1', 'dragon12', 'monkey12', 'shadow12',
  'master12', 'computer', 'internet', 'starwars', 'abcd1234', 'abc12345', 'a1b2c3d4', 'test1234',
  'temp1234', 'changeme', 'default1', 'secret12', 'india123', 'pass1234', 'pass@123', 'admin@123',
  'user@123', 'welcome@123', 'password@123', 'aaaaaaaa', 'zzzzzzzz', '11223344', '55555555',
  'qazwsxed', 'zaq12wsx', 'qwertyuiop', 'asdfghjkl', 'agastya1', 'agastya123', 'agastya@123',
  's1000d123', 's1000d@123',
]);

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function validatePassword(password) {
  if (typeof password !== 'string' || password.length === 0) return { ok: false, error: 'A password is required.' };
  if (password.length < PASSWORD_MIN) return { ok: false, error: `Password must be at least ${PASSWORD_MIN} characters.` };
  if (password.length > PASSWORD_MAX) return { ok: false, error: `Password must be at most ${PASSWORD_MAX} characters.` };
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, error: 'That password is too common. Choose something less guessable.' };
  }
  return { ok: true };
}

/*
  A chosen (permanent) password: the normal policy, plus it must not be the
  temporary-password shape for this account. Otherwise someone could "change"
  username@2026 to username@2027 and keep a guessable credential.
*/
function validateNewPassword(password, username) {
  const base = validatePassword(password);
  if (!base.ok) return base;
  const u = normalizeUsername(username);
  if (u && new RegExp(`^${u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@\\d{4}$`, 'i').test(password)) {
    return { ok: false, error: 'Choose a new password that is not based on your temporary password.' };
  }
  return { ok: true };
}

// ---- usernames ------------------------------------------------------------

// Names that must never belong to a person. The bootstrap administrator is
// the single narrow exception (allowReserved, passed only by bootstrap.js).
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'system', 'superuser', 'sysadmin', 'support', 'security',
  'operator', 'service', 'daemon', 'guest', 'nobody', 'anonymous', 'owner', 'moderator', 'staff',
  'test', 'null', 'undefined', 'api', 'agastya', 'manager', 'author', 'everyone',
]);

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const normalizeUsername = (u) => String(u || '').trim().toLowerCase();

function validateUsername(username, { allowReserved = false } = {}) {
  const u = normalizeUsername(username);
  if (!u) return { ok: false, error: 'A username is required.' };
  if (!USERNAME_RE.test(u)) {
    return { ok: false, error: 'Usernames are 3 to 32 characters: lowercase letters, digits, dot, dash or underscore, starting with a letter or digit.' };
  }
  if (!allowReserved && RESERVED_USERNAMES.has(u)) return { ok: false, error: 'That username is reserved. Choose another.' };
  return { ok: true, username: u };
}

function validateFullName(fullName) {
  const n = String(fullName || '').replace(/\s+/g, ' ').trim();
  if (!n) return { ok: false, error: 'A full name is required.' };
  if (n.length > 120) return { ok: false, error: 'That full name is too long.' };
  return { ok: true, fullName: n };
}

// ---- temporary passwords --------------------------------------------------

/*
  Temporary password: <username>@<year>, e.g. ravi@2026. Predictable by
  design (user decision, docs/decisions.md S1). It is exempt from
  validatePassword, and only this value is. The limits that make it
  acceptable are enforced elsewhere: single use and 24 h expiry at sign-in
  (routes/auth.js), forced change via the account gate (authz.js), the
  shared rate limiter, and a 30-minute cap on the gated session (sessions.js).
*/
const TEMP_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;

function tempPasswordFor(username, now = new Date()) {
  return `${normalizeUsername(username)}@${now.getFullYear()}`;
}

module.exports = {
  ROLES, ALL_ROLES,
  validatePassword, validateNewPassword, validateUsername, normalizeUsername, validateFullName,
  tempPasswordFor, TEMP_PASSWORD_TTL_MS,
  RESERVED_USERNAMES, COMMON_PASSWORDS, PASSWORD_MIN, PASSWORD_MAX,
};
