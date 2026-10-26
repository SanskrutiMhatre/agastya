// Client navigation is role-aware: each role sees only what it may use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { navFor, pathsFor } from '../client/src/nav.js';

test('Authors see no user management, approvals or audit', () => {
  const p = pathsFor('author');
  assert.ok(!p.includes('/users'));
  assert.ok(!p.includes('/approvals'));
  assert.ok(!p.includes('/audit'));
  assert.ok(p.includes('/data-modules') && p.includes('/publications'));
});

test('Project Managers see their Authors and approvals, but not the audit log', () => {
  const p = pathsFor('project_manager');
  assert.ok(p.includes('/users') && p.includes('/approvals'));
  assert.ok(!p.includes('/audit'));
  const labels = navFor('project_manager').flatMap((s) => s.items.map((i) => i.label));
  assert.ok(labels.includes('Authors') && !labels.includes('Users'));
});

test('the Software Administrator sees administration', () => {
  const p = pathsFor('software_admin');
  for (const x of ['/', '/users', '/projects', '/approvals', '/audit']) assert.ok(p.includes(x), x);
  assert.ok(!p.includes('/data-modules'), 'no authoring entry in the admin navigation');
});

test('later-phase items are labelled with their phase', () => {
  const all = ['software_admin', 'project_manager', 'author'].flatMap((r) => navFor(r).flatMap((s) => s.items));
  const phased = Object.fromEntries(all.filter((i) => i.phase).map((i) => [i.to, i.phase]));
  assert.deepEqual(phased, { '/audit': 4 }, 'approvals arrived in Phase 3');
  assert.equal(all.find((i) => i.to === '/approvals').badge, 'approvals');
});

test('an unknown role gets no navigation', () => {
  assert.deepEqual(navFor('superuser'), []);
});
