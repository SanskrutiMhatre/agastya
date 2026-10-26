'use strict';
// The evaluate() rule table, exercised directly.
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, RULES } = require('../server/auth/authz');

const admin = { id: 'a', role: 'software_admin' };
const pm = { id: 'pm', role: 'project_manager' };
const pm2 = { id: 'pm2', role: 'project_manager' };
const author = { id: 'au', role: 'author' };

const row = (id, role, createdBy) => ({ id, role, created_by: createdBy });
const myAuthor = row('w1', 'author', 'pm');
const otherAuthor = row('w2', 'author', 'pm2');

const code = (v) => (v.ok ? 'ALLOW' : `${v.http} ${v.code}`);

test('no user is 401', () => {
  assert.equal(code(evaluate(null, 'account.self')), '401 UNAUTHENTICATED');
});

test('account gates block everything except their own exit', () => {
  const onboarding = { ...author, onboardingPending: true };
  const forced = { ...pm, mustChangePassword: true };
  assert.equal(code(evaluate(onboarding, 'project.list')), '403 ONBOARDING_REQUIRED');
  assert.equal(code(evaluate(onboarding, 'account.self', {}, { allowOnboarding: true })), 'ALLOW');
  assert.equal(code(evaluate(forced, 'user.create', { role: 'author' })), '403 PASSWORD_CHANGE_REQUIRED');
  assert.equal(code(evaluate(forced, 'account.self', {}, { allowForcedChange: true })), 'ALLOW');
  assert.equal(code(evaluate(onboarding, 'account.self', {}, { allowForcedChange: true })), '403 ONBOARDING_REQUIRED');
});

test('creation hierarchy', () => {
  assert.equal(code(evaluate(admin, 'user.create', { role: 'project_manager' })), 'ALLOW');
  assert.equal(code(evaluate(admin, 'user.create', { role: 'author' })), 'ALLOW');
  assert.equal(code(evaluate(admin, 'user.create', { role: 'software_admin' })), '403 ROLE_NOT_ALLOWED');
  assert.equal(code(evaluate(pm, 'user.create', { role: 'author' })), 'ALLOW');
  assert.equal(code(evaluate(pm, 'user.create', { role: 'project_manager' })), '403 ROLE_NOT_ALLOWED');
  assert.equal(code(evaluate(pm, 'user.create', { role: 'software_admin' })), '403 ROLE_NOT_ALLOWED');
  assert.equal(code(evaluate(author, 'user.create', { role: 'author' })), '403 FORBIDDEN');
});

test('a Project Manager reaches only the Authors they created; others are 404', () => {
  for (const action of ['user.read', 'user.update', 'user.reset']) {
    assert.equal(code(evaluate(pm, action, { target: myAuthor })), 'ALLOW', action);
    assert.equal(code(evaluate(pm, action, { target: otherAuthor })), '404 NOT_FOUND', action);
    assert.equal(code(evaluate(pm, action, { target: row('pmx', 'project_manager', 'a') })), '404 NOT_FOUND', action);
    assert.equal(code(evaluate(author, action, { target: myAuthor })), '403 FORBIDDEN', action);
  }
});

test('no privilege escalation through role changes', () => {
  assert.equal(code(evaluate(admin, 'user.role.change', { target: myAuthor, role: 'project_manager' })), 'ALLOW');
  assert.equal(code(evaluate(admin, 'user.role.change', { target: myAuthor, role: 'software_admin' })), '403 ROLE_NOT_ALLOWED');
  assert.equal(code(evaluate(admin, 'user.role.change', { target: row('a', 'software_admin'), role: 'author' })), '403 ROLE_NOT_ALLOWED');
  assert.equal(code(evaluate(pm, 'user.role.change', { target: myAuthor, role: 'project_manager' })), '403 ROLE_NOT_ALLOWED');
  assert.equal(code(evaluate(pm, 'user.role.change', { target: row('pm', 'project_manager'), role: 'software_admin' })), '403 ROLE_NOT_ALLOWED');
  assert.equal(code(evaluate(author, 'user.role.change', { target: row('au', 'author'), role: 'project_manager' })), '403 FORBIDDEN');
});

test('disable/enable: the administrator, and a Project Manager for Authors they created (M7); never the administrator', () => {
  assert.equal(code(evaluate(admin, 'user.status', { target: myAuthor })), 'ALLOW');
  assert.equal(code(evaluate(admin, 'user.status', { target: row('a', 'software_admin') })), '403 ROLE_NOT_ALLOWED');
  assert.equal(code(evaluate(pm, 'user.status', { target: myAuthor })), 'ALLOW');
  assert.equal(code(evaluate(pm, 'user.status', { target: row('x', 'author', 'someone-else') })), '404 NOT_FOUND');
  assert.equal(code(evaluate(pm, 'user.status', { target: row('y', 'project_manager') })), '404 NOT_FOUND');
  assert.equal(code(evaluate(author, 'user.status', { target: myAuthor })), '403 FORBIDDEN');
  assert.equal(code(evaluate(pm, 'user.sessions.revoke', { target: myAuthor })), '403 FORBIDDEN');
  assert.equal(code(evaluate(admin, 'user.reset', { target: row('a', 'software_admin') })), '403 SELF_NOT_ALLOWED');
});

test('reset decisions follow the assigned approver; the administrator may decide any', () => {
  const req = { status: 'pending', approver_id: 'pm' };
  assert.equal(code(evaluate(pm, 'reset.decide', { request: req })), 'ALLOW');
  assert.equal(code(evaluate(pm2, 'reset.decide', { request: req })), '404 NOT_FOUND');
  assert.equal(code(evaluate(admin, 'reset.decide', { request: req })), 'ALLOW');
  assert.equal(code(evaluate(author, 'reset.decide', { request: req })), '403 FORBIDDEN');
  assert.equal(code(evaluate(pm, 'reset.decide', { request: { ...req, status: 'approved' } })), '404 NOT_FOUND');
});

const pmProject = { id: 'p1', owner_id: 'pm' };
const authorProject = { id: 'p2', owner_id: 'au' };

test('project creation: Project Managers and Authors, never the administrator', () => {
  assert.equal(code(evaluate(pm, 'project.create')), 'ALLOW');
  assert.equal(code(evaluate(author, 'project.create')), 'ALLOW');
  assert.equal(code(evaluate(admin, 'project.create')), '403 FORBIDDEN');
});

test('project visibility: owner, assigned Authors and the administrator; everyone else 404', () => {
  assert.equal(code(evaluate(pm, 'project.read', { project: pmProject })), 'ALLOW');
  assert.equal(code(evaluate(pm2, 'project.read', { project: pmProject })), '404 NOT_FOUND');
  assert.equal(code(evaluate(author, 'project.read', { project: pmProject, membership: null })), '404 NOT_FOUND');
  assert.equal(code(evaluate(author, 'project.read', { project: pmProject, membership: {} })), 'ALLOW');
  assert.equal(code(evaluate(admin, 'project.read', { project: pmProject })), 'ALLOW');
  // An Author-owned project: its owner sees it; no Project Manager does unless assigned.
  assert.equal(code(evaluate(author, 'project.read', { project: authorProject })), 'ALLOW');
  assert.equal(code(evaluate(pm, 'project.read', { project: authorProject })), '404 NOT_FOUND');
  assert.equal(code(evaluate({ id: 'au2', role: 'author' }, 'project.read', { project: authorProject })), '404 NOT_FOUND');
});

test('assignment (R12): the owner (Project Manager or Author) or the administrator; nobody else', () => {
  assert.equal(code(evaluate(pm, 'project.assign', { project: pmProject })), 'ALLOW');
  assert.equal(code(evaluate(pm2, 'project.assign', { project: pmProject })), '404 NOT_FOUND');
  assert.equal(code(evaluate(admin, 'project.assign', { project: pmProject })), 'ALLOW');
  assert.equal(code(evaluate(admin, 'project.assign', { project: authorProject })), 'ALLOW');
  assert.equal(code(evaluate(author, 'project.assign', { project: authorProject })), 'ALLOW', 'the owning Author manages members');
  assert.equal(code(evaluate({ id: 'au2', role: 'author' }, 'project.assign', { project: authorProject, membership: {} })), '403 FORBIDDEN', 'an assigned Author cannot');
  assert.equal(code(evaluate(author, 'project.assign', { project: pmProject, membership: {} })), '403 FORBIDDEN');
  assert.equal(code(evaluate(author, 'project.assign', { project: pmProject, membership: null })), '404 NOT_FOUND');
  assert.equal(code(evaluate(pm, 'project.assign', { project: authorProject })), '404 NOT_FOUND');
});

test('approval requests: the chosen manager sees and decides that request only', () => {
  const request = { id: 'r1', project_id: 'p2', submitted_by: 'au', assigned_manager_id: 'pm2' };
  assert.equal(code(evaluate(pm2, 'request.read', { request })), 'ALLOW');
  assert.equal(code(evaluate(pm2, 'request.decide', { request })), 'ALLOW');
  assert.equal(code(evaluate(pm2, 'project.read', { project: authorProject })), '404 NOT_FOUND', 'the request does not open the project');
  assert.equal(code(evaluate(pm, 'request.read', { request })), '404 NOT_FOUND', 'another manager');
  assert.equal(code(evaluate(pm, 'request.decide', { request })), '404 NOT_FOUND');
  assert.equal(code(evaluate(author, 'request.read', { request })), 'ALLOW', 'the submitter');
  assert.equal(code(evaluate(author, 'request.decide', { request })), '403 FORBIDDEN');
  assert.equal(code(evaluate({ id: 'x', role: 'author' }, 'request.read', { request })), '404 NOT_FOUND');
  assert.equal(code(evaluate(admin, 'request.read', { request })), 'ALLOW');
  assert.equal(code(evaluate(admin, 'request.decide', { request })), '403 OVERRIDE_REQUIRED', 'admin decisions are Phase 4 overrides');
});

test('submitting: an owner or assigned Author, to an active Project Manager', () => {
  const approver = { id: 'pm2', role: 'project_manager', disabled_at: null };
  assert.equal(code(evaluate(author, 'request.submit', { project: authorProject, approver })), 'ALLOW');
  assert.equal(code(evaluate(author, 'request.submit', { project: pmProject, membership: {}, approver })), 'ALLOW');
  assert.equal(code(evaluate(author, 'request.submit', { project: pmProject, membership: null, approver })), '404 NOT_FOUND');
  assert.equal(code(evaluate(author, 'request.submit', { project: authorProject, approver: { ...approver, disabled_at: 'x' } })), '400 APPROVER_INVALID');
  assert.equal(code(evaluate(author, 'request.submit', { project: authorProject, approver: { id: 'a', role: 'software_admin' } })), '400 APPROVER_INVALID');
  assert.equal(code(evaluate(author, 'request.submit', { project: authorProject, approver: null })), '400 APPROVER_INVALID');
  assert.equal(code(evaluate(pm, 'request.submit', { project: pmProject, approver })), '403 FORBIDDEN', 'submitting stays an Author action');
  assert.equal(code(evaluate(admin, 'request.submit', { project: pmProject, approver })), '403 FORBIDDEN');
});

test('each dashboard belongs to exactly one role', () => {
  const users = { admin, pm, author };
  const own = { admin: 'dashboard.admin', pm: 'dashboard.manager', author: 'dashboard.author' };
  for (const [who, u] of Object.entries(users)) {
    for (const [, action] of Object.entries(own)) {
      const expected = own[who] === action ? 'ALLOW' : '403 FORBIDDEN';
      assert.equal(code(evaluate(u, action)), expected, `${who} ${action}`);
    }
  }
});

test('an unknown action is never allowed', () => {
  assert.equal(code(evaluate(admin, 'anything.at.all')), '403 FORBIDDEN');
  assert.ok(Object.keys(RULES).length > 15);
});
