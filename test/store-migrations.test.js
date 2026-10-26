'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Store } = require('../server/db/store');
const { MIGRATIONS } = require('../server/db/migrations');
const { tmpdir } = require('./helpers');

const NOW = '2026-10-20T10:00:00.000Z';

function fresh() {
  const s = new Store(path.join(tmpdir(), 'agastya.db'));
  s.migrate(NOW);
  return s;
}

const mkUser = (s, id, role, extra = {}) => s.createUser({ id, username: id, fullName: id, role, passwordHash: '$scrypt$x', now: NOW, ...extra });

test('migrations are named, recorded and idempotent', () => {
  const s = fresh();
  assert.deepEqual(s.appliedMigrations(), MIGRATIONS.map((m) => m.name).sort());
  assert.deepEqual(s.migrate(NOW), [], 'a second run applies nothing');
  const tables = s.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  for (const t of ['users', 'sessions', 'audit_log', 'password_reset_requests', 'projects', 'project_members', 'notifications', 'schema_migrations']) {
    assert.ok(tables.includes(t), `table ${t}`);
  }
  s.close();
});

test('the database runs in WAL mode with foreign keys on', () => {
  const s = fresh();
  assert.equal(s.db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
  assert.equal(s.db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  s.close();
});

test('the database itself refuses a second Software Administrator', () => {
  const s = fresh();
  mkUser(s, 'admin1', 'software_admin');
  assert.throws(() => mkUser(s, 'admin2', 'software_admin'), /UNIQUE/);
  s.close();
});

test('the database refuses any role outside the three', () => {
  const s = fresh();
  assert.throws(() => mkUser(s, 'boss', 'superuser'), /CHECK/);
  s.close();
});

test('audit_log is append-only', () => {
  const s = fresh();
  const id = s.appendAudit({ at: NOW, action: 'test.event' });
  assert.throws(() => s.db.prepare('UPDATE audit_log SET action = ? WHERE id = ?').run('x', id), /append-only/);
  assert.throws(() => s.db.prepare('DELETE FROM audit_log WHERE id = ?').run(id), /append-only/);
  assert.equal(s.listRecentAudit(5).length, 1);
  s.close();
});

test('one pending reset request per account', () => {
  const s = fresh();
  mkUser(s, 'admin1', 'software_admin');
  mkUser(s, 'writer', 'author');
  assert.equal(s.createResetRequest({ id: 'r1', userId: 'writer', approverId: 'admin1', now: NOW }).created, true);
  assert.equal(s.createResetRequest({ id: 'r2', userId: 'writer', approverId: 'admin1', now: NOW }).created, false);
  s.decideResetRequest('r1', 'approved', 'admin1', NOW);
  assert.equal(s.createResetRequest({ id: 'r3', userId: 'writer', approverId: 'admin1', now: NOW }).created, true);
  s.close();
});

test('a new session displaces the account\'s other live sessions', () => {
  const s = fresh();
  mkUser(s, 'writer', 'author');
  const later = '2027-01-01T00:00:00.000Z';
  s.insertSessionDisplacing({ id: 's1', userId: 'writer', tokenHash: 'h1', now: NOW, expiresAt: later });
  const r = s.insertSessionDisplacing({ id: 's2', userId: 'writer', tokenHash: 'h2', now: NOW, expiresAt: later });
  assert.equal(r.displaced, 1);
  assert.equal(s.resolveSession('h1', NOW), null);
  assert.ok(s.resolveSession('h2', NOW));
  s.close();
});

test('005 upgrades an existing database: owner_id is backfilled from manager_id', () => {
  const { DatabaseSync } = require('node:sqlite');
  const file = path.join(tmpdir(), 'agastya.db');
  // Build a database as it was after migration 004, with one project in it.
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);');
  for (const m of MIGRATIONS.slice(0, 4)) {
    db.exec(m.sql);
    db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(m.name, NOW);
  }
  db.prepare("INSERT INTO users (id, username, full_name, role, password_hash, created_at, updated_at) VALUES ('pm','pm','PM','project_manager','$x',?,?)").run(NOW, NOW);
  db.prepare("INSERT INTO projects (id, name, manager_id, created_by, created_at, updated_at) VALUES ('p1','Old','pm','pm',?,?)").run(NOW, NOW);
  db.close();

  const s = new Store(file);
  assert.deepEqual(s.migrate(NOW), MIGRATIONS.slice(4).map((m) => m.name), 'only the newer migrations run');
  assert.equal(MIGRATIONS[4].name, '005-project-ownership');
  assert.equal(s.getProject('p1').owner_id, 'pm', 'existing row keeps its owner');
  assert.equal(s.getProject('p1').name, 'Old');
  s.close();
});

test('every project must have an owner', () => {
  const s = fresh();
  mkUser(s, 'w1', 'author');
  assert.throws(() => s.db.prepare("INSERT INTO projects (id, name, manager_id, created_by, created_at, updated_at) VALUES ('p','n','w1','w1',?,?)").run(NOW, NOW), /owner_id is required/);
  const p = s.createProject({ id: 'p2', name: 'Mine', ownerId: 'w1', createdBy: 'w1', now: NOW });
  assert.equal(p.owner_role, 'author');
  assert.throws(() => s.db.prepare('UPDATE projects SET owner_id = NULL WHERE id = ?').run('p2'), /owner_id is required/);
  s.close();
});

test('updateUser refuses columns outside the allow-list', () => {
  const s = fresh();
  mkUser(s, 'writer', 'author');
  assert.throws(() => s.updateUser('writer', { created_by: 'x' }, NOW), /unknown column/);
  s.close();
});
