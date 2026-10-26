'use strict';
// The one authorization service. Every API route is guarded by exactly one of
// the factories below, and every decision is made by evaluate() from the rule
// table. Handlers do not make their own authorization decisions; where a
// handler needs a second decision (a role change inside an update), it calls
// evaluate() too.
//
// Denials are uniform:
//   401 UNAUTHENTICATED        no session, or the account is disabled
//   403 ONBOARDING_REQUIRED     account gate; only the gate's own exit is open
//   403 PASSWORD_CHANGE_REQUIRED
//   403 FORBIDDEN               the caller's role may not do this at all
//   403 ROLE_NOT_ALLOWED        an attempt to grant or change a role beyond scope
//   404 NOT_FOUND               the resource is outside the caller's scope (or absent);
//                               scope is never disclosed
//
// Guards carry marker properties (isAuthGuard / isPublicMarker) that
// test/routes-guarded.test.js reads: a route with neither fails the build.

const { ROLES } = require('./policy');

const { ADMIN, MANAGER, AUTHOR } = ROLES;

const ALLOW = Object.freeze({ ok: true });
const deny = (http, code) => ({ ok: false, http, code });
const UNAUTH = deny(401, 'UNAUTHENTICATED');
const FORBIDDEN = deny(403, 'FORBIDDEN');
const ROLE_NOT_ALLOWED = deny(403, 'ROLE_NOT_ALLOWED');
const NOT_FOUND = deny(404, 'NOT_FOUND');

const isAdmin = (u) => u.role === ADMIN;
const isManager = (u) => u.role === MANAGER;
const isAuthor = (u) => u.role === AUTHOR;

// A Project Manager's account scope: the Authors they created.
const managesAccount = (u, target) => isManager(u) && !!target && target.role === AUTHOR && target.created_by === u.id;

/*
  The rule table. Each rule receives the signed-in user (from the session)
  and the context its guard loaded, and returns ALLOW or a denial. Role
  checks come first, so a caller with the wrong role learns nothing about
  whether a resource exists.
*/
const RULES = {
  // Signed in: me, sign-out, notifications, own password.
  'account.self': () => ALLOW,

  'user.list': (u) => (isAdmin(u) || isManager(u) ? ALLOW : FORBIDDEN),

  // Creation hierarchy. Nobody can create a Software Administrator.
  'user.create': (u, { role }) => {
    if (isAuthor(u)) return FORBIDDEN;
    if (isAdmin(u)) return role === MANAGER || role === AUTHOR ? ALLOW : ROLE_NOT_ALLOWED;
    if (isManager(u)) return role === AUTHOR ? ALLOW : ROLE_NOT_ALLOWED;
    return FORBIDDEN;
  },

  'user.read': (u, { target }) => {
    if (isAuthor(u)) return FORBIDDEN;
    if (!target) return NOT_FOUND;
    if (isAdmin(u)) return ALLOW;
    return managesAccount(u, target) ? ALLOW : NOT_FOUND;
  },

  // Name edits. Role edits are a separate decision (user.role.change).
  'user.update': (u, { target }) => {
    if (isAuthor(u)) return FORBIDDEN;
    if (!target) return NOT_FOUND;
    if (isAdmin(u)) return ALLOW;
    return managesAccount(u, target) ? ALLOW : NOT_FOUND;
  },

  // Issue or reissue a temporary password.
  'user.reset': (u, { target }) => {
    if (isAuthor(u)) return FORBIDDEN;
    if (!target) return NOT_FOUND;
    if (isAdmin(u)) return target.id === u.id ? deny(403, 'SELF_NOT_ALLOWED') : ALLOW;
    return managesAccount(u, target) ? ALLOW : NOT_FOUND;
  },

  // Only between Project Manager and Author; never to or from administrator;
  // never your own role.
  'user.role.change': (u, { target, role }) => {
    if (!isAdmin(u)) return isAuthor(u) ? FORBIDDEN : ROLE_NOT_ALLOWED;
    if (!target) return NOT_FOUND;
    if (target.id === u.id || target.role === ADMIN) return ROLE_NOT_ALLOWED;
    return role === MANAGER || role === AUTHOR ? ALLOW : ROLE_NOT_ALLOWED;
  },

  // Disable / enable (decisions.md M7): the administrator for any other
  // account; a Project Manager for the Authors they created.
  'user.status': (u, { target }) => {
    if (isAuthor(u)) return FORBIDDEN;
    if (!target) return NOT_FOUND;
    if (isAdmin(u)) return target.role === ADMIN ? ROLE_NOT_ALLOWED : ALLOW;
    return managesAccount(u, target) ? ALLOW : NOT_FOUND;
  },

  // Sign a user out everywhere.
  'user.sessions.revoke': (u, { target }) => {
    if (!isAdmin(u)) return FORBIDDEN;
    return target ? ALLOW : NOT_FOUND;
  },

  'session.revoke': (u, { session }) => {
    if (!isAdmin(u)) return FORBIDDEN;
    return session ? ALLOW : NOT_FOUND;
  },

  'reset.list': (u) => (isAdmin(u) || isManager(u) ? ALLOW : FORBIDDEN),

  'reset.decide': (u, { request }) => {
    if (isAuthor(u)) return FORBIDDEN;
    if (!request || request.status !== 'pending') return NOT_FOUND;
    if (isAdmin(u)) return ALLOW;
    return request.approver_id === u.id ? ALLOW : NOT_FOUND;
  },

  'project.list': () => ALLOW,

  // Project Managers and Authors create projects and own them (R9).
  'project.create': (u) => (isManager(u) || isAuthor(u) ? ALLOW : FORBIDDEN),

  // Visible to its owner, its assigned Authors and the administrator. Anyone
  // else (another manager included) gets 404: the project is not disclosed.
  'project.read': (u, { project, membership }) => {
    if (!project) return NOT_FOUND;
    if (isAdmin(u) || project.owner_id === u.id || membership) return ALLOW;
    return NOT_FOUND;
  },

  /*
    Assign / remove Authors (R12): the project's owner, whether a Project
    Manager or an Author, and the administrator on any project. An assigned
    Author cannot; another Project Manager cannot even see the project.
  */
  'project.assign': (u, { project, membership }) => {
    if (!project) return NOT_FOUND;
    if (isAdmin(u) || project.owner_id === u.id) return ALLOW;
    return membership ? FORBIDDEN : NOT_FOUND;
  },

  // Reading project content (data modules, graphics, the built PDF) and
  // building PDFs: anyone who can see the project.
  'content.read': (u, ctx) => RULES['project.read'](u, ctx),
  'content.build': (u, ctx) => RULES['project.read'](u, ctx),

  /*
    Writing project content (decisions.md D2): the Authors who own or are
    assigned to the project. A Project Manager reviews rather than authors,
    so the owning manager reads but does not write. The administrator's
    content edits need a written reason and are a Phase 4 override.
  */
  'content.write': (u, ctx) => {
    const { project, membership } = ctx;
    if (!project) return NOT_FOUND;
    if (isAdmin(u)) return deny(403, 'OVERRIDE_REQUIRED');
    const visible = project.owner_id === u.id || membership;
    if (!visible) return NOT_FOUND;
    return isAuthor(u) ? ALLOW : FORBIDDEN;
  },

  /*
    Publication approval requests (W1). The routes arrive in Phase 2/3; the
    rules are fixed now. A request is visible to the Author who submitted it,
    the Project Manager it was sent to and the administrator. Being chosen as
    approver gives sight of that request only, never of the project
    (project.read above is unchanged by it).
  */
  'request.read': (u, { request }) => {
    if (!request) return NOT_FOUND;
    if (isAdmin(u) || request.submitted_by === u.id || request.assigned_manager_id === u.id) return ALLOW;
    return NOT_FOUND;
  },

  // Deciding is the chosen Project Manager's. The administrator's override,
  // with a written reason, is Phase 4 and is a separate action.
  'request.decide': (u, { request }) => {
    if (!request) return NOT_FOUND;
    if (isAdmin(u)) return deny(403, 'OVERRIDE_REQUIRED');
    if (isAuthor(u)) return request.submitted_by === u.id ? FORBIDDEN : NOT_FOUND;
    return request.assigned_manager_id === u.id ? ALLOW : NOT_FOUND;
  },

  // Submitting: an Author who owns or is assigned to the project, sending it
  // to an active Project Manager (the routing target is checked here too).
  'request.submit': (u, { project, membership, approver }) => {
    if (!project) return NOT_FOUND;
    if (!isAuthor(u)) return RULES['project.read'](u, { project, membership }).ok ? FORBIDDEN : NOT_FOUND;
    if (!(project.owner_id === u.id || membership)) return NOT_FOUND;
    if (!approver || approver.role !== MANAGER || approver.disabled_at) return deny(400, 'APPROVER_INVALID');
    return ALLOW;
  },

  // The approvals queue: a Project Manager's own requests; the administrator sees all (oversight).
  'request.queue': (u) => (isAdmin(u) || isManager(u) ? ALLOW : FORBIDDEN),

  // Withdrawing: only the Author who submitted it, while it is pending.
  'request.withdraw': (u, { request }) => {
    if (!request) return NOT_FOUND;
    if (!RULES['request.read'](u, { request }).ok) return NOT_FOUND;
    if (request.submitted_by !== u.id) return FORBIDDEN;
    return request.status === 'pending' ? ALLOW : deny(409, 'NOT_PENDING');
  },

  'dashboard.admin': (u) => (isAdmin(u) ? ALLOW : FORBIDDEN),
  'dashboard.manager': (u) => (isManager(u) ? ALLOW : FORBIDDEN),
  'dashboard.author': (u) => (isAuthor(u) ? ALLOW : FORBIDDEN),
};

/*
  Account gates, in priority order. While onboarding is pending the account
  may only onboard; while a password change is forced it may only change the
  password. Sign-out and /me stay reachable through both.
*/
function gateCheck(user, { allowOnboarding = false, allowForcedChange = false } = {}) {
  if (user.onboardingPending && !allowOnboarding) return deny(403, 'ONBOARDING_REQUIRED');
  if (!user.onboardingPending && user.mustChangePassword && !allowForcedChange) return deny(403, 'PASSWORD_CHANGE_REQUIRED');
  return null;
}

/*
  THE authorization decision. `user` is the session user, or null.
  `opts` carries the gate exits a route is allowed to pass through.
*/
function evaluate(user, action, ctx = {}, opts = {}) {
  if (!user) return UNAUTH;
  const gate = gateCheck(user, opts);
  if (gate) return gate;
  const rule = RULES[action];
  if (!rule) return FORBIDDEN; // an unknown action is never allowed
  return rule(user, ctx || {});
}

const MESSAGES = {
  UNAUTHENTICATED: 'Sign in to continue.',
  ONBOARDING_REQUIRED: 'Complete first sign-in setup before doing anything else.',
  PASSWORD_CHANGE_REQUIRED: 'Change your password before doing anything else.',
  FORBIDDEN: 'You do not have permission to do that.',
  ROLE_NOT_ALLOWED: 'You cannot grant or change that role.',
  SELF_NOT_ALLOWED: 'You cannot do that to your own account.',
  OVERRIDE_REQUIRED: 'An administrator decision is an override and needs a written reason.',
  APPROVER_INVALID: 'Choose an active Project Manager to send the request to.',
  NOT_PENDING: 'Only a pending request can be withdrawn.',
  NOT_FOUND: 'Not found.',
};

function sendDenial(res, v) {
  return res.status(v.http).json({ error: MESSAGES[v.code] || MESSAGES.FORBIDDEN, code: v.code });
}

function createAuthz({ store, sessions, now = () => new Date() }) {
  function resolveAuth(req) {
    if (req.auth !== undefined) return req.auth;
    req.auth = sessions.resolveFromCookieHeader(req.headers.cookie || '') || null;
    if (req.auth) {
      // Last-seen touch, at most once a minute per session (display only).
      const last = Date.parse(req.auth.session.lastSeenAt || 0) || 0;
      if (now().getTime() - last > 60000) {
        try { store.touchSession(req.auth.session.id, now().toISOString()); } catch { /* display only */ }
      }
    }
    return req.auth;
  }

  // Signed-in guard for the caller's own account. opts names gate exits.
  function requireAuth(opts = {}) {
    const mw = function requireAuthGuard(req, res, next) {
      const auth = resolveAuth(req);
      const v = evaluate(auth && auth.user, 'account.self', {}, opts);
      if (!v.ok) return sendDenial(res, v);
      next();
    };
    mw.isAuthGuard = 'requireAuth';
    return mw;
  }

  /*
    Action guard. `load(req, store)` returns the context the rule needs (a
    target user, a project and the caller's membership, ...). It runs only
    for a signed-in, ungated caller, and its result is kept on req.ctx so the
    handler does not reload it.
  */
  function can(action, load = null) {
    if (!RULES[action]) throw new Error(`can(): unknown action ${action}`);
    const mw = function canGuard(req, res, next) {
      const auth = resolveAuth(req);
      const user = auth && auth.user;
      const pre = evaluate(user, 'account.self');
      if (!pre.ok) return sendDenial(res, pre);
      let ctx = {};
      try { ctx = load ? load(req, store, user) || {} : {}; } catch { ctx = {}; }
      const v = evaluate(user, action, ctx);
      if (!v.ok) return sendDenial(res, v);
      req.ctx = ctx;
      next();
    };
    mw.isAuthGuard = `can(${action})`;
    return mw;
  }

  // Explicitly public routes state their reason; the guard test reads it.
  function publicRoute(reason) {
    if (!reason || typeof reason !== 'string') throw new Error('publicRoute requires a stated reason');
    const mw = function publicRouteMarker(req, res, next) { next(); };
    mw.isPublicMarker = reason;
    return mw;
  }

  return { evaluate, requireAuth, can, publicRoute, resolveAuth };
}

// Context loaders shared by route modules.
const loaders = {
  targetUser: (req, store) => ({ target: store.getUser(req.params.id) }),
  project: (req, store, user) => {
    const project = store.getProject(req.params.id);
    return { project, membership: project ? store.getMembership(project.id, user.id) : null };
  },
  // A data module inside a project: absent, or in another project, reads as no data module.
  dataModule: (req, store, user) => {
    const project = store.getProject(req.params.id);
    const dm = project ? store.getDataModule(req.params.dmId) : null;
    return {
      project,
      membership: project ? store.getMembership(project.id, user.id) : null,
      dm: dm && dm.project_id === project.id ? dm : null,
    };
  },
  resetRequest: (req, store) => ({ request: store.getResetRequest(req.params.id) }),
  // Submitting: the project, and the approver named in the body (checked by the rule).
  requestSubmit: (req, store, user) => {
    const project = store.getProject(req.params.id);
    const id = req.body && typeof req.body.approverId === 'string' ? req.body.approverId : null;
    return { project, membership: project ? store.getMembership(project.id, user.id) : null, approver: id ? store.getUser(id) : null };
  },
  publicationRequest: (req, store) => ({ request: store.getRequest(req.params.reqId) }),
  session: (req, store) => ({ session: store.getSession(req.params.id) }),
};

module.exports = { createAuthz, evaluate, sendDenial, loaders, RULES, MESSAGES };
