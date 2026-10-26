'use strict';
// User management: the directory, account creation within the hierarchy,
// detail, renames and role changes, temporary-password resets, disable and
// enable, and session revocation. Every decision is evaluate()'s; the
// `permissions` block in a detail response is evaluate() too, so the client
// never re-implements a rule.

const { hashPassword, newId } = require('../auth/crypto');
const policy = require('../auth/policy');
const { publicUser, issueTempPassword } = require('../auth/accounts');
const { evaluate, sendDenial, loaders } = require('../auth/authz');
const { body, query } = require('../http/validate');
const { handle, sendError } = require('../http/errors');

const { ADMIN, MANAGER, AUTHOR } = policy.ROLES;

function register({ app, store, authz, audit, now, clientIp }) {
  const { can } = authz;
  const nowIso = () => now().toISOString();
  const actorOf = (req) => req.auth.user;

  app.get('/api/users',
    can('user.list'),
    query({
      search: { type: 'string', max: 64 },
      role: { type: 'string', enum: [ADMIN, MANAGER, AUTHOR] },
      status: { type: 'string', enum: ['active', 'disabled', 'pending'] },
    }),
    (req, res) => {
      const me = actorOf(req);
      const filters = { ...req.validQuery };
      // A Project Manager's directory is the Authors they created.
      if (me.role === MANAGER) { filters.createdBy = me.id; filters.role = AUTHOR; }
      const at = now();
      res.json({ users: store.listUsers(filters).map((u) => publicUser(u, at)) });
    });

  app.post('/api/users',
    can('user.create', (req) => ({ role: req.body && req.body.role })),
    body({
      username: { type: 'string', required: true, max: 64, label: 'Username' },
      fullName: { type: 'string', required: true, max: 120, label: 'Full name' },
      role: { type: 'string', required: true, enum: [MANAGER, AUTHOR], label: 'Role' },
    }),
    handle(async (req, res) => {
      const me = actorOf(req);
      const u = policy.validateUsername(req.valid.username);
      if (!u.ok) return sendError(res, 400, 'VALIDATION', u.error);
      const n = policy.validateFullName(req.valid.fullName);
      if (!n.ok) return sendError(res, 400, 'VALIDATION', n.error);
      if (store.findUserByUsername(u.username)) return sendError(res, 409, 'USERNAME_TAKEN', 'That username is already taken.');

      const at = now();
      const tempPassword = policy.tempPasswordFor(u.username, at);
      const expiresAt = new Date(at.getTime() + policy.TEMP_PASSWORD_TTL_MS).toISOString();
      let user;
      try {
        user = store.createUser({
          id: newId(), username: u.username, fullName: n.fullName, role: req.valid.role,
          passwordHash: await hashPassword(tempPassword), onboardingPending: 1,
          tempPasswordExpiresAt: expiresAt, createdBy: me.id, now: at.toISOString(),
        });
      } catch (e) {
        if (/UNIQUE/i.test(e.message)) return sendError(res, 409, 'USERNAME_TAKEN', 'That username is already taken.');
        throw e;
      }
      audit({
        actorId: me.id, actorUsername: me.username, ip: clientIp(req),
        action: 'user.created', targetType: 'user', targetId: user.id,
        meta: { username: user.username, role: user.role, creatorRole: me.role, expiresAt },
      });
      res.status(201).json({ ok: true, user: publicUser(user, at), tempPassword, tempPasswordExpiresAt: expiresAt });
    }));

  app.get('/api/users/:id',
    can('user.read', loaders.targetUser),
    (req, res) => {
      const me = actorOf(req);
      const target = req.ctx.target;
      const full = store.listUsers({ search: target.username }).find((u) => u.id === target.id) || target;
      const allowed = (action, ctx) => evaluate(me, action, { target, ...ctx }).ok;
      const out = {
        user: publicUser(full, now()),
        projects: [
          ...store.listProjectsOwnedBy(target.id).map((p) => ({ id: p.id, name: p.name, relation: 'owner', since: p.created_at })),
          ...store.listProjectsForMember(target.id).map((p) => ({ id: p.id, name: p.name, relation: 'assigned', since: p.added_at })),
        ],
        createdAccounts: store.countCreatedBy(target.id),
        permissions: {
          editName: allowed('user.update'),
          reset: allowed('user.reset') && !target.disabled_at,
          changeRole: allowed('user.role.change', { role: target.role === MANAGER ? AUTHOR : MANAGER }),
          disable: allowed('user.status'),
          revokeSessions: allowed('user.sessions.revoke'),
        },
      };
      if (out.permissions.revokeSessions) {
        out.sessions = store.listActiveSessionsForUser(target.id, nowIso()).map((s) => ({
          id: s.id, createdAt: s.created_at, expiresAt: s.expires_at, lastSeenAt: s.last_seen_at, ip: s.ip, userAgent: s.user_agent,
        }));
      }
      res.json(out);
    });

  app.patch('/api/users/:id',
    can('user.update', loaders.targetUser),
    body({
      fullName: { type: 'string', max: 120, label: 'Full name' },
      role: { type: 'string', enum: [ADMIN, MANAGER, AUTHOR], label: 'Role' },
    }),
    (req, res) => {
      const me = actorOf(req);
      const target = req.ctx.target;
      const fields = {};
      const changes = {};
      if (req.valid.fullName !== undefined) {
        const n = policy.validateFullName(req.valid.fullName);
        if (!n.ok) return sendError(res, 400, 'VALIDATION', n.error);
        if (n.fullName !== target.full_name) { fields.full_name = n.fullName; changes.fullName = true; }
      }
      if (req.valid.role !== undefined && req.valid.role !== target.role) {
        const v = evaluate(me, 'user.role.change', { target, role: req.valid.role });
        if (!v.ok) return sendDenial(res, v);
        if (target.role === MANAGER && (store.countOwnedProjects(target.id) > 0 || store.countCreatedBy(target.id) > 0)) {
          return sendError(res, 409, 'HAS_DEPENDENTS', 'This Project Manager still owns projects or Author accounts. Reassign them first.');
        }
        if (target.role === AUTHOR && store.countMemberships(target.id) > 0) {
          return sendError(res, 409, 'HAS_ASSIGNMENTS', 'This Author is assigned to projects. Remove the assignments first.');
        }
        fields.role = req.valid.role;
      }
      if (!Object.keys(fields).length) return sendError(res, 400, 'NO_CHANGES', 'Nothing to change.');
      store.updateUser(target.id, fields, nowIso());
      if (fields.role) {
        audit({ actorId: me.id, actorUsername: me.username, ip: clientIp(req), action: 'user.role.changed',
          targetType: 'user', targetId: target.id, meta: { username: target.username, from: target.role, to: fields.role } });
      }
      if (changes.fullName) {
        audit({ actorId: me.id, actorUsername: me.username, ip: clientIp(req), action: 'user.updated',
          targetType: 'user', targetId: target.id, meta: { username: target.username, fields: ['fullName'] } });
      }
      res.json({ ok: true, user: publicUser(store.getUser(target.id), now()) });
    });

  // Issue, or reissue, a temporary password (decisions.md S1).
  app.post('/api/users/:id/reset',
    can('user.reset', loaders.targetUser),
    body({}),
    handle(async (req, res) => {
      const target = req.ctx.target;
      if (target.disabled_at) return sendError(res, 409, 'ACCOUNT_DISABLED', 'Enable the account before issuing a temporary password.');
      const { tempPassword, expiresAt } = await issueTempPassword({
        store, audit, target, actor: actorOf(req), ip: clientIp(req), reason: target.temp_password_expires_at ? 'reissue' : 'reset', now,
      });
      res.json({ ok: true, user: publicUser(store.getUser(target.id), now()), tempPassword, tempPasswordExpiresAt: expiresAt });
    }));

  app.post('/api/users/:id/disable',
    can('user.status', loaders.targetUser),
    body({}),
    (req, res) => {
      const me = actorOf(req);
      const target = req.ctx.target;
      if (!target.disabled_at) {
        store.updateUser(target.id, { disabled_at: nowIso() }, nowIso());
        // Access ends immediately: every live session is revoked.
        const revoked = store.revokeAllSessionsForUser(target.id, 'account-disabled', nowIso());
        audit({ actorId: me.id, actorUsername: me.username, ip: clientIp(req), action: 'user.disabled',
          targetType: 'user', targetId: target.id, meta: { username: target.username, sessionsRevoked: revoked } });
      }
      res.json({ ok: true, user: publicUser(store.getUser(target.id), now()) });
    });

  app.post('/api/users/:id/enable',
    can('user.status', loaders.targetUser),
    body({}),
    (req, res) => {
      const me = actorOf(req);
      const target = req.ctx.target;
      if (target.disabled_at) {
        store.updateUser(target.id, { disabled_at: null }, nowIso());
        audit({ actorId: me.id, actorUsername: me.username, ip: clientIp(req), action: 'user.enabled',
          targetType: 'user', targetId: target.id, meta: { username: target.username } });
      }
      res.json({ ok: true, user: publicUser(store.getUser(target.id), now()) });
    });

  app.post('/api/users/:id/sessions/revoke',
    can('user.sessions.revoke', loaders.targetUser),
    body({}),
    (req, res) => {
      const me = actorOf(req);
      const target = req.ctx.target;
      const revoked = store.revokeAllSessionsForUser(target.id, 'admin-revoked', nowIso());
      audit({ actorId: me.id, actorUsername: me.username, ip: clientIp(req), action: 'auth.sessions.revoked',
        targetType: 'user', targetId: target.id, meta: { username: target.username, count: revoked } });
      res.json({ ok: true, revoked });
    });

  app.post('/api/sessions/:id/revoke',
    can('session.revoke', loaders.session),
    body({}),
    (req, res) => {
      const me = actorOf(req);
      const s = req.ctx.session;
      const n = store.revokeSessionById(s.id, 'admin-revoked', nowIso());
      if (n) {
        audit({ actorId: me.id, actorUsername: me.username, ip: clientIp(req), action: 'auth.session.revoked',
          targetType: 'user', targetId: s.user_id, meta: { sessionId: s.id } });
      }
      res.json({ ok: true, revoked: n });
    });
}

module.exports = { register };
