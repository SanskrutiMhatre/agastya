'use strict';
// Session lifecycle: opaque random tokens, stored server-side as SHA-256
// only, delivered in an HttpOnly SameSite=Lax cookie. A fresh session is
// issued at every authentication boundary (sign-in, onboarding, password
// change), so a pre-authentication cookie can never carry over (no fixation).

const { newToken, sha256hex, newId } = require('./crypto');

const COOKIE_NAME = 'agastya_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, absolute
// A session issued while an account gate is open (onboarding or forced
// change) is capped, so an abandoned temporary-password sign-in does not
// stay usable for a week. decisions.md A4.
const GATED_SESSION_TTL_MS = 30 * 60 * 1000;

function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    let v = part.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}

function cookieFor(token, { secure = false, maxAgeMs = SESSION_TTL_MS } = {}) {
  const parts = [`${COOKIE_NAME}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearCookie({ secure = false } = {}) {
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

const isGated = (u) => !!(u.onboarding_pending || u.must_change_password);

class SessionService {
  constructor(store, { now = () => new Date(), secureCookies = false } = {}) {
    this.store = store;
    this.now = now;
    this.secureCookies = secureCookies;
  }

  // Secure when forced on, or when this request arrived over TLS (req.secure
  // honours X-Forwarded-Proto only when trust proxy is enabled).
  isSecureReq(req) {
    return this.secureCookies || !!(req && req.secure);
  }

  /*
    Issue a session for a user row, displacing every other live session for
    the account (single active session). The raw token is returned once.
  */
  issue(userRow, { ip, userAgent, req } = {}) {
    const token = newToken();
    const now = this.now();
    const ttl = isGated(userRow) ? GATED_SESSION_TTL_MS : SESSION_TTL_MS;
    const { displaced } = this.store.insertSessionDisplacing({
      id: newId(),
      userId: userRow.id,
      tokenHash: sha256hex(token),
      now: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
      ip,
      userAgent: userAgent ? String(userAgent).slice(0, 200) : null,
    });
    return { displaced, cookie: cookieFor(token, { secure: this.isSecureReq(req), maxAgeMs: ttl }) };
  }

  // Cookie -> { session, user } in one query; null for anything not live.
  resolveFromCookieHeader(cookieHeader) {
    const token = parseCookies(cookieHeader)[COOKIE_NAME];
    if (!token || token.length < 20 || token.length > 128) return null;
    const row = this.store.resolveSession(sha256hex(token), this.now().toISOString());
    if (!row) return null;
    return {
      session: { id: row.session_id, createdAt: row.session_created_at, expiresAt: row.expires_at, lastSeenAt: row.last_seen_at },
      user: {
        id: row.user_id,
        username: row.username,
        fullName: row.full_name,
        role: row.role,
        createdBy: row.created_by,
        mustChangePassword: !!row.must_change_password,
        onboardingPending: !!row.onboarding_pending,
      },
    };
  }

  clearCookieValue(req) {
    return clearCookie({ secure: this.isSecureReq(req) });
  }
}

module.exports = { SessionService, COOKIE_NAME, SESSION_TTL_MS, GATED_SESSION_TTL_MS, parseCookies, cookieFor, clearCookie };
