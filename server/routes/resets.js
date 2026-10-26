'use strict';
// The forgot-password queue, decided by the creating Project Manager or the
// Software Administrator (decisions.md A10). Approval issues a temporary
// password through the same path as a direct reset.

const { issueTempPassword } = require('../auth/accounts');
const { loaders } = require('../auth/authz');
const policy = require('../auth/policy');
const { body } = require('../http/validate');
const { handle, sendError } = require('../http/errors');

function register({ app, store, authz, audit, now, clientIp }) {
  const { can } = authz;
  const nowIso = () => now().toISOString();

  app.get('/api/resets',
    can('reset.list'),
    (req, res) => {
      const me = req.auth.user;
      const rows = me.role === policy.ROLES.ADMIN ? store.listPendingResets() : store.listPendingResets({ approverId: me.id });
      res.json({
        requests: rows.map((r) => ({
          id: r.id,
          requestedAt: r.requested_at,
          user: { id: r.user_id, username: r.username, fullName: r.full_name, role: r.role, onboardingPending: !!r.onboarding_pending },
          approver: r.approver_id ? { id: r.approver_id, username: r.approver_username, fullName: r.approver_name } : null,
          assignedToMe: r.approver_id === me.id,
        })),
      });
    });

  app.post('/api/resets/:id/approve',
    can('reset.decide', loaders.resetRequest),
    body({}),
    handle(async (req, res) => {
      const me = req.auth.user;
      const request = req.ctx.request;
      const target = store.getUser(request.user_id);
      if (!target) return sendError(res, 404, 'NOT_FOUND', 'Not found.');
      if (target.disabled_at) return sendError(res, 409, 'ACCOUNT_DISABLED', 'This account is disabled. Enable it before approving a reset.');
      if (!store.decideResetRequest(request.id, 'approved', me.id, nowIso())) {
        return sendError(res, 409, 'ALREADY_DECIDED', 'This request was already decided.');
      }
      const override = request.approver_id !== me.id;
      audit({ actorId: me.id, actorUsername: me.username, ip: clientIp(req), action: 'reset.approved',
        targetType: 'user', targetId: target.id, meta: { requestId: request.id, username: target.username, override: override || undefined } });
      const { tempPassword, expiresAt } = await issueTempPassword({
        store, audit, target, actor: me, ip: clientIp(req), reason: 'reset-request', now,
      });
      res.json({ ok: true, username: target.username, tempPassword, tempPasswordExpiresAt: expiresAt });
    }));

  app.post('/api/resets/:id/reject',
    can('reset.decide', loaders.resetRequest),
    body({}),
    (req, res) => {
      const me = req.auth.user;
      const request = req.ctx.request;
      if (!store.decideResetRequest(request.id, 'rejected', me.id, nowIso())) {
        return sendError(res, 409, 'ALREADY_DECIDED', 'This request was already decided.');
      }
      const override = request.approver_id !== me.id;
      audit({ actorId: me.id, actorUsername: me.username, ip: clientIp(req), action: 'reset.rejected',
        targetType: 'user', targetId: request.user_id, meta: { requestId: request.id, override: override || undefined } });
      res.json({ ok: true });
    });
}

module.exports = { register };
