'use strict';
// Sign-in, sign-out, the account gates (onboarding, forced change), voluntary
// password change, and the public forgot-password request.
//
// There is deliberately no registration or setup route: accounts are created
// only by an authorised user (routes/users.js) or by the environment
// bootstrap (auth/bootstrap.js).

const { hashPassword, verifyPassword, dummyVerify, newId } = require('../auth/crypto');
const policy = require('../auth/policy');
const { publicUser, gatesOf, resolveResetApprover } = require('../auth/accounts');
const { body } = require('../http/validate');
const { handle, sendError } = require('../http/errors');

const LOGIN_FAIL = { error: 'Invalid username or password.', code: 'BAD_CREDENTIALS' };
const FORGOT_BODY = { ok: true, message: 'If that account exists, the person who manages it has been asked to reset the password.' };

function register({ app, store, sessions, authz, audit, limiter, now, clientIp, userAgent }) {
  const { requireAuth, publicRoute } = authz;
  const nowIso = () => now().toISOString();

  function tooMany(res, rl) {
    res.set('Retry-After', String(rl.retryAfterSeconds));
    return res.status(429).json({ error: 'Too many attempts. Try again later.', code: 'RATE_LIMITED', retryAfterSeconds: rl.retryAfterSeconds });
  }

  function startSession(req, res, userRow) {
    const { cookie, displaced } = sessions.issue(userRow, { ip: clientIp(req), userAgent: userAgent(req), req });
    res.set('Set-Cookie', cookie);
    return displaced;
  }

  app.post('/api/auth/login',
    publicRoute('The sign-in endpoint itself; uniform failures, rate-limited per username and client IP.'),
    body({ username: { type: 'string', required: true, max: 64 }, password: { type: 'password', required: true, max: 256 } }),
    handle(async (req, res) => {
      const { username, password } = req.valid;
      const ip = clientIp(req);
      const rl = limiter.attempt(username.toLowerCase(), ip);
      if (!rl.allowed) return tooMany(res, rl);

      const user = store.findUserByUsername(username);
      if (!user) {
        await dummyVerify(password); // same work, same answer as a wrong password
        audit({ action: 'auth.login.failed', ip, meta: { username: username.slice(0, 64), reason: 'unknown-user' } });
        return res.status(401).json(LOGIN_FAIL);
      }
      if (!(await verifyPassword(user.password_hash, password))) {
        audit({ actorId: user.id, actorUsername: user.username, action: 'auth.login.failed', ip, meta: { reason: 'bad-password' } });
        return res.status(401).json(LOGIN_FAIL);
      }
      if (user.disabled_at) {
        audit({ actorId: user.id, actorUsername: user.username, action: 'auth.login.failed', ip, meta: { reason: 'disabled' } });
        return res.status(401).json(LOGIN_FAIL);
      }

      // Temporary password limits (decisions.md S1): first sign-in only, 24 h.
      const at = now();
      const usingTemp = !!user.temp_password_expires_at;
      if (usingTemp) {
        if (user.temp_password_used_at) {
          audit({ actorId: user.id, actorUsername: user.username, action: 'auth.login.failed', ip, meta: { reason: 'temp-password-used' } });
          return sendError(res, 401, 'TEMP_PASSWORD_USED', 'This temporary password has already been used. Ask the person who manages your account to issue a new one.');
        }
        if (Date.parse(user.temp_password_expires_at) <= at.getTime()) {
          audit({ actorId: user.id, actorUsername: user.username, action: 'auth.login.failed', ip, meta: { reason: 'temp-password-expired' } });
          return sendError(res, 401, 'TEMP_PASSWORD_EXPIRED', 'This temporary password has expired. Ask the person who manages your account to issue a new one.');
        }
      }

      store.updateUser(user.id, {
        last_login_at: at.toISOString(),
        ...(usingTemp ? { temp_password_used_at: at.toISOString() } : {}),
      }, at.toISOString());
      limiter.clear(username.toLowerCase(), ip);
      const fresh = store.getUser(user.id);
      const displaced = startSession(req, res, fresh);
      audit({ actorId: user.id, actorUsername: user.username, action: 'auth.login', ip, meta: { temporary: usingTemp || undefined, displaced: displaced || undefined } });
      res.json({ ok: true, user: publicUser(fresh, at), gates: gatesOf(fresh) });
    }));

  app.post('/api/auth/logout',
    requireAuth({ allowOnboarding: true, allowForcedChange: true }),
    body({}),
    (req, res) => {
      const { user, session } = req.auth;
      store.revokeSessionById(session.id, 'signout', nowIso());
      audit({ actorId: user.id, actorUsername: user.username, action: 'auth.logout', ip: clientIp(req) });
      res.set('Set-Cookie', sessions.clearCookieValue(req));
      res.json({ ok: true });
    });

  app.get('/api/auth/me',
    requireAuth({ allowOnboarding: true, allowForcedChange: true }),
    (req, res) => {
      const fresh = store.getUser(req.auth.user.id);
      const out = { user: publicUser(fresh, now()), gates: gatesOf(fresh) };
      const gated = out.gates.onboarding || out.gates.mustChangePassword;
      if (!gated) {
        out.unreadNotifications = store.unreadNotificationCount(fresh.id);
        if (fresh.role === policy.ROLES.ADMIN) out.queues = { resets: store.listPendingResets().length };
        if (fresh.role === policy.ROLES.MANAGER) out.queues = { resets: store.listPendingResets({ approverId: fresh.id }).length, approvals: store.listRequests({ managerId: fresh.id, limit: 1000 }).filter((r) => r.status === 'pending').length };
      }
      res.json(out);
    });

  /*
    One change-password route for the forced and the voluntary case. Inside
    the forced-change gate the session itself was just established with the
    temporary password, so the current password is not asked again
    (decisions.md A11). A voluntary change needs it and is rate-limited.
  */
  app.post('/api/auth/change-password',
    requireAuth({ allowForcedChange: true }),
    body({ currentPassword: { type: 'password', max: 256 }, newPassword: { type: 'password', required: true, max: 256 } }),
    handle(async (req, res) => {
      const { user } = req.auth;
      const ip = clientIp(req);
      const fresh = store.getUser(user.id);
      const forced = !!fresh.must_change_password;
      const { currentPassword = '', newPassword } = req.valid;

      if (!forced) {
        const rl = limiter.attempt(fresh.username, ip);
        if (!rl.allowed) return tooMany(res, rl);
        if (!(await verifyPassword(fresh.password_hash, currentPassword))) {
          audit({ actorId: fresh.id, actorUsername: fresh.username, action: 'auth.password.change_failed', ip });
          return sendError(res, 400, 'BAD_CURRENT_PASSWORD', 'Your current password is incorrect.');
        }
        limiter.clear(fresh.username, ip);
      }
      const p = policy.validateNewPassword(newPassword, fresh.username);
      if (!p.ok) return sendError(res, 400, 'PASSWORD_POLICY', p.error);
      if (await verifyPassword(fresh.password_hash, newPassword)) {
        return sendError(res, 400, 'PASSWORD_POLICY', 'Choose a password different from your current one.');
      }

      store.updateUser(fresh.id, {
        password_hash: await hashPassword(newPassword),
        must_change_password: 0,
        temp_password_expires_at: null,
        temp_password_used_at: null,
      }, nowIso());
      const displaced = startSession(req, res, store.getUser(fresh.id));
      audit({ actorId: fresh.id, actorUsername: fresh.username, action: 'auth.password.changed', ip, meta: { forced, sessionsRevoked: displaced } });
      res.json({ ok: true, user: publicUser(store.getUser(fresh.id), now()) });
    }));

  /*
    First sign-in for an account someone else created: confirm the full name
    and choose a password. The username was fixed by the creator.
  */
  app.post('/api/auth/onboarding',
    requireAuth({ allowOnboarding: true }),
    body({ fullName: { type: 'string', required: true, max: 120 }, newPassword: { type: 'password', required: true, max: 256 } }),
    handle(async (req, res) => {
      const fresh = store.getUser(req.auth.user.id);
      if (!fresh.onboarding_pending) return sendError(res, 409, 'ALREADY_ONBOARDED', 'Setup is already complete.');
      const n = policy.validateFullName(req.valid.fullName);
      if (!n.ok) return sendError(res, 400, 'VALIDATION', n.error);
      const p = policy.validateNewPassword(req.valid.newPassword, fresh.username);
      if (!p.ok) return sendError(res, 400, 'PASSWORD_POLICY', p.error);

      store.updateUser(fresh.id, {
        full_name: n.fullName,
        password_hash: await hashPassword(req.valid.newPassword),
        onboarding_pending: 0,
        must_change_password: 0,
        temp_password_expires_at: null,
        temp_password_used_at: null,
      }, nowIso());
      const displaced = startSession(req, res, store.getUser(fresh.id));
      audit({ actorId: fresh.id, actorUsername: fresh.username, action: 'auth.onboarding.completed', ip: clientIp(req), meta: { sessionsRevoked: displaced } });
      res.json({ ok: true, user: publicUser(store.getUser(fresh.id), now()) });
    }));

  /*
    Forgot password: a request queue, not self-service. The answer is the
    same 202 whether or not the account exists, and the sign-in rate limiter
    covers it. The Software Administrator's own request cannot be approved by
    anyone; it is recorded for the audit trail only (break-glass tool: A9).
  */
  app.post('/api/auth/forgot',
    publicRoute('Neutral-response reset request: identical 202 whether or not the account exists; shares the sign-in rate limiter.'),
    body({ username: { type: 'string', required: true, max: 64 } }),
    (req, res) => {
      const { username } = req.valid;
      const ip = clientIp(req);
      const rl = limiter.attempt(username.toLowerCase(), ip);
      if (!rl.allowed) return tooMany(res, rl);
      try {
        const user = store.findUserByUsername(username);
        if (user && !user.disabled_at) {
          if (user.role === policy.ROLES.ADMIN) {
            audit({ actorId: user.id, actorUsername: user.username, action: 'reset.requested.admin', ip });
          } else {
            const approverId = resolveResetApprover(store, user);
            const r = store.createResetRequest({ id: newId(), userId: user.id, approverId, now: nowIso(), ip });
            if (r.created) {
              audit({ actorId: user.id, actorUsername: user.username, action: 'reset.requested', ip,
                targetType: 'reset', targetId: r.request.id, meta: { username: user.username, approverId } });
            }
          }
        }
      } catch (e) {
        console.error('[auth] forgot error:', e.message); // the body stays neutral
      }
      res.status(202).json(FORGOT_BODY);
    });
}

module.exports = { register };
