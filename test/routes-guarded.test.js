'use strict';
// STATIC GUARD COVERAGE. Every registered route must carry exactly one guard
// (requireAuth / can(...), marked .isAuthGuard) as its FIRST handler, or be
// explicitly public with a stated reason (publicRoute, .isPublicMarker). A
// route with neither fails the build. The app is built against a throwaway
// data directory and never listens.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('../server/server');
const { tmpdir, quietLog } = require('./helpers');

const { app, stop } = createServer({ dataDir: tmpdir(), env: {}, log: quietLog });
test.after(() => stop());

function collectRoutes() {
  const stack = (app.router && app.router.stack) || [];
  return stack.filter((l) => l.route).map((l) => ({
    path: l.route.path,
    methods: Object.keys(l.route.methods).filter((m) => l.route.methods[m]),
    handles: l.route.stack.map((s) => s.handle),
  }));
}
const label = (r) => `${r.methods.join(',').toUpperCase()} ${r.path}`;

test('every route has a guard or a stated public reason', () => {
  const routes = collectRoutes();
  assert.ok(routes.length >= 25, `expected a real route table, saw ${routes.length}`);
  const unguarded = routes.filter((r) => !r.handles.some((h) => h.isAuthGuard || h.isPublicMarker)).map(label);
  assert.deepEqual(unguarded, [], 'routes with no guard:\n  ' + unguarded.join('\n  '));
});

test('the guard is the first handler on every route, and there is only one', () => {
  for (const r of collectRoutes()) {
    const first = r.handles[0];
    assert.ok(first && (first.isAuthGuard || first.isPublicMarker), `${label(r)}: guard must be first`);
    const guards = r.handles.filter((h) => h.isAuthGuard || h.isPublicMarker);
    assert.equal(guards.length, 1, `${label(r)}: exactly one guard`);
  }
});

test('the public set is exactly the intended one', () => {
  const pub = collectRoutes().filter((r) => r.handles[0].isPublicMarker);
  for (const r of pub) assert.ok(r.handles[0].isPublicMarker.length > 20, `${label(r)} must state a real reason`);
  assert.deepEqual(pub.map(label).sort(), [
    'GET /api/health', 'GET /{*splat}', 'POST /api/auth/forgot', 'POST /api/auth/login',
  ], 'a new public route needs a deliberate security decision');
});

test('no self-registration or setup route exists', () => {
  const offending = collectRoutes().filter((r) => /regist|signup|sign-up|setup|invite|enrol/i.test(r.path)).map(label);
  assert.deepEqual(offending, []);
  const userCreate = collectRoutes().find((r) => r.path === '/api/users' && r.methods.includes('post'));
  assert.match(userCreate.handles[0].isAuthGuard, /can\(user\.create\)/);
});

test('route modules register routes only through app.<method>(path, guard, ...)', () => {
  // Source-level check: no Router() side-door that the table walk above would not see.
  const dir = path.join(__dirname, '..', 'server');
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p);
    }
  })(dir);
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/express\.Router\s*\(/.test(src) && !/\bRouter\s*\(\s*\)/.test(src), `${path.relative(dir, f)} must not create a Router`);
    const calls = src.match(/app\.(get|post|put|patch|delete|all)\(\s*'[^']+',\s*\n?\s*[a-zA-Z]+/g) || [];
    for (const c of calls) {
      assert.match(c, /,\s*\n?\s*(publicRoute|requireAuth|can)$/, `${path.relative(dir, f)}: ${c.replace(/\s+/g, ' ')}`);
    }
  }
});
