'use strict';
// Every SQL statement in the application lives here. Timestamps are ISO
// strings supplied by callers, so tests can control the clock.

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { MIGRATIONS } = require('./migrations');

// Columns updateUser() may touch. Anything else is a programming error.
const USER_COLUMNS = new Set([
  'username', 'full_name', 'role', 'password_hash', 'must_change_password', 'onboarding_pending',
  'temp_password_expires_at', 'temp_password_used_at', 'disabled_at', 'last_login_at',
]);

class Store {
  constructor(file) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.cache = new Map();
  }

  stmt(sql) {
    let s = this.cache.get(sql);
    if (!s) { s = this.db.prepare(sql); this.cache.set(sql, s); }
    return s;
  }

  close() { this.db.close(); }

  migrate(nowIso) {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);');
    const applied = new Set(this.db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
    const ran = [];
    for (const m of MIGRATIONS) {
      if (applied.has(m.name)) continue;
      this.db.exec('BEGIN');
      try {
        this.db.exec(m.sql);
        this.db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(m.name, nowIso);
        this.db.exec('COMMIT');
        ran.push(m.name);
      } catch (e) {
        this.db.exec('ROLLBACK');
        throw new Error(`Migration ${m.name} failed: ${e.message}`);
      }
    }
    return ran;
  }

  appliedMigrations() {
    return this.db.prepare('SELECT name FROM schema_migrations ORDER BY name').all().map((r) => r.name);
  }

  tx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  // ---- users --------------------------------------------------------------

  createUser({ id, username, fullName, role, passwordHash, mustChangePassword = 0, onboardingPending = 0,
    tempPasswordExpiresAt = null, createdBy = null, now }) {
    this.stmt(`INSERT INTO users (id, username, full_name, role, password_hash, must_change_password,
        onboarding_pending, temp_password_expires_at, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, username, fullName, role, passwordHash, mustChangePassword ? 1 : 0, onboardingPending ? 1 : 0,
        tempPasswordExpiresAt, createdBy, now, now);
    return this.getUser(id);
  }

  getUser(id) {
    return this.stmt('SELECT * FROM users WHERE id = ?').get(String(id)) || null;
  }

  findUserByUsername(username) {
    return this.stmt('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(String(username || '')) || null;
  }

  getAdmin() {
    return this.stmt("SELECT * FROM users WHERE role = 'software_admin'").get() || null;
  }

  /*
    Directory listing. createdBy narrows to one creator's accounts (a Project
    Manager's scope). status: active | disabled | pending (onboarding).
  */
  listUsers({ search = '', role = null, status = null, createdBy = null } = {}) {
    const where = [];
    const args = [];
    if (createdBy) { where.push('u.created_by = ?'); args.push(createdBy); }
    if (role) { where.push('u.role = ?'); args.push(role); }
    if (status === 'active') where.push('u.disabled_at IS NULL AND u.onboarding_pending = 0');
    if (status === 'disabled') where.push('u.disabled_at IS NOT NULL');
    if (status === 'pending') where.push('u.disabled_at IS NULL AND u.onboarding_pending = 1');
    const q = String(search || '').trim();
    if (q) {
      const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
      where.push("(u.username LIKE ? ESCAPE '\\' OR u.full_name LIKE ? ESCAPE '\\')");
      args.push(like, like);
    }
    const sql = `SELECT u.*, c.username AS created_by_username, c.full_name AS created_by_name,
        (SELECT COUNT(*) FROM project_members m WHERE m.user_id = u.id) AS project_count,
        (SELECT COUNT(*) FROM projects p WHERE p.owner_id = u.id) AS owned_count
      FROM users u LEFT JOIN users c ON c.id = u.created_by
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY u.created_at DESC`;
    return this.db.prepare(sql).all(...args);
  }

  updateUser(id, fields, now) {
    const keys = Object.keys(fields);
    for (const k of keys) if (!USER_COLUMNS.has(k)) throw new Error(`updateUser: unknown column ${k}`);
    if (!keys.length) return;
    const sql = `UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`;
    this.db.prepare(sql).run(...keys.map((k) => fields[k]), now, id);
  }

  countUsersByRole() {
    return this.stmt(`SELECT role,
        SUM(CASE WHEN disabled_at IS NULL THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN disabled_at IS NOT NULL THEN 1 ELSE 0 END) AS disabled,
        SUM(CASE WHEN disabled_at IS NULL AND onboarding_pending = 1 THEN 1 ELSE 0 END) AS pending
      FROM users GROUP BY role`).all();
  }

  countCreatedBy(userId) {
    return this.stmt('SELECT COUNT(*) AS n FROM users WHERE created_by = ?').get(userId).n;
  }

  // ---- sessions -----------------------------------------------------------

  insertSessionDisplacing({ id, userId, tokenHash, now, expiresAt, ip, userAgent }) {
    return this.tx(() => {
      this.stmt(`INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, ip, user_agent)
                 VALUES (?,?,?,?,?,?,?,?)`).run(id, userId, tokenHash, now, expiresAt, now, ip || null, userAgent || null);
      const r = this.stmt(`UPDATE sessions SET revoked_at = ?, revoke_reason = 'displaced'
                           WHERE user_id = ? AND id != ? AND revoked_at IS NULL`).run(now, userId, id);
      return { displaced: Number(r.changes) };
    });
  }

  /*
    Token hash -> session + user in ONE query. Unknown token, revoked or
    expired session and disabled account all fall out of the same WHERE
    clause, so no code path can forget one of them.
  */
  resolveSession(tokenHash, nowIso) {
    return this.stmt(`SELECT s.id AS session_id, s.user_id, s.created_at AS session_created_at,
             s.expires_at, s.last_seen_at, u.*
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.disabled_at IS NULL`)
      .get(tokenHash, nowIso) || null;
  }

  touchSession(sessionId, now) {
    this.stmt('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(now, sessionId);
  }

  getSession(id) {
    return this.stmt('SELECT * FROM sessions WHERE id = ?').get(String(id)) || null;
  }

  revokeSessionById(sessionId, reason, now) {
    return Number(this.stmt('UPDATE sessions SET revoked_at = ?, revoke_reason = ? WHERE id = ? AND revoked_at IS NULL')
      .run(now, reason, sessionId).changes);
  }

  revokeAllSessionsForUser(userId, reason, now) {
    return Number(this.stmt('UPDATE sessions SET revoked_at = ?, revoke_reason = ? WHERE user_id = ? AND revoked_at IS NULL')
      .run(now, reason, userId).changes);
  }

  listActiveSessionsForUser(userId, now) {
    return this.stmt(`SELECT id, created_at, expires_at, last_seen_at, ip, user_agent FROM sessions
      WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC`).all(userId, now);
  }

  countActiveSessions(now) {
    return this.stmt(`SELECT COUNT(*) AS n FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.revoked_at IS NULL AND s.expires_at > ? AND u.disabled_at IS NULL`).get(now).n;
  }

  // ---- audit --------------------------------------------------------------

  appendAudit({ at, actorId = null, actorUsername = null, ip = null, action, targetType = null, targetId = null, projectId = null, meta = null }) {
    const r = this.stmt(`INSERT INTO audit_log (at, actor_id, actor_username, ip, action, target_type, target_id, project_id, meta)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(at, actorId, actorUsername, ip, action, targetType, targetId, projectId, meta == null ? null : JSON.stringify(meta));
    return Number(r.lastInsertRowid);
  }

  listRecentAudit(limit = 20) {
    return this.stmt(`SELECT id, at, actor_username, action, target_type, target_id, project_id, meta
      FROM audit_log ORDER BY id DESC LIMIT ?`).all(limit);
  }

  // Successful and failed sign-ins per UTC day since a given instant.
  signInSeries(sinceIso) {
    return this.stmt(`SELECT substr(at, 1, 10) AS day,
        SUM(CASE WHEN action = 'auth.login' THEN 1 ELSE 0 END) AS ok,
        SUM(CASE WHEN action = 'auth.login.failed' THEN 1 ELSE 0 END) AS failed
      FROM audit_log WHERE at >= ? AND action IN ('auth.login','auth.login.failed')
      GROUP BY day ORDER BY day`).all(sinceIso);
  }

  // ---- password reset queue ----------------------------------------------

  // Returns { created: true, request } or { created: false } when one is already pending.
  createResetRequest({ id, userId, approverId, now, ip }) {
    try {
      this.stmt(`INSERT INTO password_reset_requests (id, user_id, approver_id, status, requested_at, requested_ip)
        VALUES (?,?,?,'pending',?,?)`).run(id, userId, approverId, now, ip || null);
      return { created: true, request: this.getResetRequest(id) };
    } catch (e) {
      if (/UNIQUE/i.test(e.message)) return { created: false };
      throw e;
    }
  }

  getResetRequest(id) {
    return this.stmt('SELECT * FROM password_reset_requests WHERE id = ?').get(String(id)) || null;
  }

  // approverId null = every pending request (the Software Administrator's view).
  listPendingResets({ approverId = null } = {}) {
    const sql = `SELECT r.*, u.username, u.full_name, u.role, u.disabled_at, u.onboarding_pending,
        a.username AS approver_username, a.full_name AS approver_name
      FROM password_reset_requests r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN users a ON a.id = r.approver_id
      WHERE r.status = 'pending' ${approverId ? 'AND r.approver_id = ?' : ''}
      ORDER BY r.requested_at`;
    return approverId ? this.stmt(sql).all(approverId) : this.stmt(sql).all();
  }

  decideResetRequest(id, status, decidedBy, now) {
    return Number(this.stmt(`UPDATE password_reset_requests SET status = ?, decided_by = ?, decided_at = ?
      WHERE id = ? AND status = 'pending'`).run(status, decidedBy, now, id).changes) === 1;
  }

  // ---- projects -----------------------------------------------------------

  // owner_id is the one owner (Author or Project Manager). manager_id is a
  // legacy NOT NULL column (migration 005) and only mirrors owner_id.
  createProject({ id, name, description, ownerId, createdBy, now }) {
    this.stmt(`INSERT INTO projects (id, name, description, owner_id, manager_id, created_by, status, created_at, updated_at)
      VALUES (?,?,?,?,?,?,'active',?,?)`).run(id, name, description || '', ownerId, ownerId, createdBy, now, now);
    return this.getProject(id);
  }

  getProject(id) {
    return this.stmt(`SELECT p.*, o.username AS owner_username, o.full_name AS owner_name, o.role AS owner_role
      FROM projects p JOIN users o ON o.id = p.owner_id WHERE p.id = ?`).get(String(id)) || null;
  }

  projectNameTaken(name) {
    return !!this.stmt('SELECT 1 FROM projects WHERE name = ? COLLATE NOCASE').get(String(name));
  }

  /*
    Projects with owner and author counts. ownerId: projects a user owns.
    userId: projects a user owns OR is assigned to (an Author's view), with
    the relation. No filter: every project (the Software Administrator).
  */
  listProjects({ ownerId = null, userId = null } = {}) {
    const base = `SELECT p.*, o.username AS owner_username, o.full_name AS owner_name, o.role AS owner_role,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS author_count`;
    if (ownerId) {
      return this.stmt(`${base} FROM projects p JOIN users o ON o.id = p.owner_id
        WHERE p.owner_id = ? ORDER BY p.created_at DESC`).all(ownerId);
    }
    if (userId) {
      return this.stmt(`${base},
          CASE WHEN p.owner_id = ? THEN 'owner' ELSE 'assigned' END AS relation,
          (SELECT added_at FROM project_members x WHERE x.project_id = p.id AND x.user_id = ?) AS assigned_at
        FROM projects p JOIN users o ON o.id = p.owner_id
        WHERE p.owner_id = ? OR EXISTS (SELECT 1 FROM project_members me WHERE me.project_id = p.id AND me.user_id = ?)
        ORDER BY p.created_at DESC`).all(userId, userId, userId, userId);
    }
    return this.stmt(`${base} FROM projects p JOIN users o ON o.id = p.owner_id ORDER BY p.created_at DESC`).all();
  }

  countProjects() {
    return this.stmt("SELECT COUNT(*) AS n FROM projects WHERE status = 'active'").get().n;
  }

  countOwnedProjects(userId) {
    return this.stmt('SELECT COUNT(*) AS n FROM projects WHERE owner_id = ?').get(userId).n;
  }

  getMembership(projectId, userId) {
    return this.stmt('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?').get(String(projectId), String(userId)) || null;
  }

  countMemberships(userId) {
    return this.stmt('SELECT COUNT(*) AS n FROM project_members WHERE user_id = ?').get(userId).n;
  }

  listMembers(projectId) {
    return this.stmt(`SELECT pm.user_id, pm.added_at, u.username, u.full_name, u.disabled_at, u.onboarding_pending,
        a.username AS added_by_username
      FROM project_members pm JOIN users u ON u.id = pm.user_id LEFT JOIN users a ON a.id = pm.added_by
      WHERE pm.project_id = ? ORDER BY u.full_name`).all(projectId);
  }

  // Active Authors not yet on the project and not its owner: candidates for assignment.
  listAssignableAuthors(projectId) {
    return this.stmt(`SELECT u.id, u.username, u.full_name, u.onboarding_pending FROM users u
      WHERE u.role = 'author' AND u.disabled_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = ? AND pm.user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = ? AND p.owner_id = u.id)
      ORDER BY u.full_name`).all(projectId, projectId);
  }

  addMember(projectId, userId, addedBy, now) {
    const r = this.stmt(`INSERT OR IGNORE INTO project_members (project_id, user_id, role, added_by, added_at)
      VALUES (?, ?, 'author', ?, ?)`).run(projectId, userId, addedBy, now);
    return Number(r.changes) === 1;
  }

  removeMember(projectId, userId) {
    return Number(this.stmt('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, userId).changes) === 1;
  }

  listProjectsForMember(userId) {
    return this.stmt(`SELECT p.id, p.name, p.owner_id, pm.added_at FROM project_members pm JOIN projects p ON p.id = pm.project_id
      WHERE pm.user_id = ? ORDER BY p.name`).all(userId);
  }

  listProjectsOwnedBy(userId) {
    return this.stmt('SELECT id, name, created_at FROM projects WHERE owner_id = ? ORDER BY name').all(userId);
  }

  // ---- documents and revisions --------------------------------------------

  createDocument({ id, projectId, relPath, kind, now }) {
    this.stmt(`INSERT INTO documents (id, project_id, rel_path, kind, created_at, updated_at) VALUES (?,?,?,?,?,?)`)
      .run(id, projectId, relPath, kind, now, now);
    return this.getDocument(id);
  }

  getDocument(id) {
    return this.stmt('SELECT * FROM documents WHERE id = ?').get(String(id)) || null;
  }

  findLiveDocument(projectId, relPath) {
    return this.stmt('SELECT * FROM documents WHERE project_id = ? AND rel_path = ? AND deleted_at IS NULL').get(projectId, relPath) || null;
  }

  moveDocument(id, relPath, now) {
    this.stmt('UPDATE documents SET rel_path = ?, updated_at = ? WHERE id = ?').run(relPath, now, id);
  }

  setDocumentDeleted(id, deletedAt, now) {
    this.stmt('UPDATE documents SET deleted_at = ?, updated_at = ? WHERE id = ?').run(deletedAt, now, id);
  }

  touchDocument(id, now) {
    this.stmt('UPDATE documents SET updated_at = ? WHERE id = ?').run(now, id);
  }

  // Content is stored once per distinct SHA-256; returns true if it was new.
  putBlob(hash, content, now) {
    const r = this.stmt('INSERT OR IGNORE INTO blobs (hash, content, size, created_at) VALUES (?,?,?,?)').run(hash, content, content.length, now);
    return Number(r.changes) === 1;
  }

  getBlob(hash) {
    return this.stmt('SELECT * FROM blobs WHERE hash = ?').get(hash) || null;
  }

  addRevision({ documentId, hash, relPath, reason, now, userId }) {
    const r = this.stmt('INSERT INTO revisions (document_id, hash, rel_path, reason, created_at, created_by) VALUES (?,?,?,?,?,?)')
      .run(documentId, hash, relPath, reason, now, userId || null);
    return this.getRevision(Number(r.lastInsertRowid));
  }

  getRevision(id) {
    return this.stmt(`SELECT r.*, u.username AS created_by_username, u.full_name AS created_by_name
      FROM revisions r LEFT JOIN users u ON u.id = r.created_by WHERE r.id = ?`).get(Number(id)) || null;
  }

  headRevision(documentId) {
    return this.stmt(`SELECT r.*, u.username AS created_by_username, u.full_name AS created_by_name
      FROM revisions r LEFT JOIN users u ON u.id = r.created_by
      WHERE r.document_id = ? ORDER BY r.id DESC LIMIT 1`).get(documentId) || null;
  }

  listRevisions(documentId, limit = 200) {
    return this.stmt(`SELECT r.id, r.hash, r.rel_path, r.reason, r.created_at, r.created_by,
        u.username AS created_by_username, u.full_name AS created_by_name, b.size
      FROM revisions r LEFT JOIN users u ON u.id = r.created_by JOIN blobs b ON b.hash = r.hash
      WHERE r.document_id = ? ORDER BY r.id DESC LIMIT ?`).all(documentId, limit);
  }

  // ---- data modules -------------------------------------------------------

  createDataModule({ id, projectId, documentId, dmc, schemaType, issue, techName, infoName, userId, now }) {
    this.stmt(`INSERT INTO data_modules (id, project_id, document_id, dmc, schema_type, issue, tech_name, info_name,
        created_by, created_at, updated_by, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, projectId, documentId, dmc, schemaType, issue || null, techName || '', infoName || '', userId, now, userId, now);
    return this.getDataModule(id);
  }

  getDataModule(id) {
    return this.stmt(`SELECT dm.*, d.rel_path, c.full_name AS created_by_name, up.full_name AS updated_by_name
      FROM data_modules dm JOIN documents d ON d.id = dm.document_id
      LEFT JOIN users c ON c.id = dm.created_by LEFT JOIN users up ON up.id = dm.updated_by
      WHERE dm.id = ?`).get(String(id)) || null;
  }

  findLiveDataModule(projectId, dmc) {
    return this.stmt('SELECT * FROM data_modules WHERE project_id = ? AND dmc = ? AND deleted_at IS NULL').get(projectId, dmc) || null;
  }

  listDataModules(projectId, { includeDeleted = false } = {}) {
    return this.stmt(`SELECT dm.*, d.rel_path, up.full_name AS updated_by_name
      FROM data_modules dm JOIN documents d ON d.id = dm.document_id
      LEFT JOIN users up ON up.id = dm.updated_by
      WHERE dm.project_id = ? ${includeDeleted ? '' : 'AND dm.deleted_at IS NULL'}
      ORDER BY dm.dmc`).all(projectId);
  }

  updateDataModule(id, fields, userId, now) {
    const allowed = new Set(['dmc', 'schema_type', 'issue', 'tech_name', 'info_name', 'status', 'deleted_at', 'deleted_by']);
    const keys = Object.keys(fields);
    for (const k of keys) if (!allowed.has(k)) throw new Error(`updateDataModule: unknown column ${k}`);
    const sql = `UPDATE data_modules SET ${keys.map((k) => `${k} = ?`).join(', ')}${keys.length ? ', ' : ''}updated_by = ?, updated_at = ? WHERE id = ?`;
    this.db.prepare(sql).run(...keys.map((k) => fields[k]), userId, now, id);
  }

  countDataModulesByAuthor(userId) {
    return this.stmt(`SELECT dm.status, COUNT(*) AS n FROM data_modules dm
      WHERE dm.deleted_at IS NULL AND (dm.created_by = ? OR dm.updated_by = ?) GROUP BY dm.status`).all(userId, userId);
  }

  // ---- graphics -----------------------------------------------------------

  upsertGraphic({ id, projectId, icn, relPath, format, size, sha256, title, userId, now }) {
    this.stmt(`INSERT INTO graphics (id, project_id, icn, rel_path, format, size, sha256, title, uploaded_by, uploaded_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(project_id, icn) DO UPDATE SET rel_path = excluded.rel_path, format = excluded.format, size = excluded.size,
        sha256 = excluded.sha256, title = CASE WHEN excluded.title = '' THEN graphics.title ELSE excluded.title END,
        uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at`)
      .run(id, projectId, icn, relPath, format, size, sha256, title || '', userId, now);
    return this.getGraphic(projectId, icn);
  }

  getGraphic(projectId, icn) {
    return this.stmt(`SELECT g.*, u.full_name AS uploaded_by_name FROM graphics g LEFT JOIN users u ON u.id = g.uploaded_by
      WHERE g.project_id = ? AND g.icn = ?`).get(projectId, icn) || null;
  }

  listGraphics(projectId) {
    return this.stmt(`SELECT g.*, u.full_name AS uploaded_by_name FROM graphics g LEFT JOIN users u ON u.id = g.uploaded_by
      WHERE g.project_id = ? ORDER BY g.icn`).all(projectId);
  }

  // ---- publication requests ---------------------------------------------

  createRequest(r) {
    this.stmt(`INSERT INTO publication_requests (id, project_id, publication_ref, publication_title, submitted_by, assigned_manager_id,
        status, note, content_fingerprint, snapshot_dir, validation_errors, validation_warnings, pdf_sha256, submitted_at, updated_at)
      VALUES (?,?,?,?,?,?,'pending',?,?,?,?,?,?,?,?)`)
      .run(r.id, r.projectId, r.publicationRef, r.publicationTitle || '', r.submittedBy, r.managerId, r.note || '', r.fingerprint,
        r.snapshotDir, r.errors || 0, r.warnings || 0, r.pdfSha256 || null, r.now, r.now);
    return this.getRequest(r.id);
  }

  getRequest(id) {
    return this.stmt(`SELECT r.*, p.name AS project_name, s.full_name AS submitted_by_name, s.username AS submitted_by_username,
        m.full_name AS manager_name, m.username AS manager_username, d.full_name AS decided_by_name
      FROM publication_requests r JOIN projects p ON p.id = r.project_id
      JOIN users s ON s.id = r.submitted_by JOIN users m ON m.id = r.assigned_manager_id LEFT JOIN users d ON d.id = r.decided_by
      WHERE r.id = ?`).get(String(id)) || null;
  }

  findPendingRequest(projectId, publicationRef) {
    return this.stmt("SELECT * FROM publication_requests WHERE project_id = ? AND publication_ref = ? AND status = 'pending'")
      .get(projectId, publicationRef) || null;
  }

  listPendingRequestsForProject(projectId) {
    return this.stmt("SELECT * FROM publication_requests WHERE project_id = ? AND status = 'pending'").all(projectId);
  }

  listRequests({ projectId = null, submittedBy = null, managerId = null, limit = 100, pendingFirst = false } = {}) {
    const where = [], args = [];
    if (projectId) { where.push('r.project_id = ?'); args.push(projectId); }
    if (submittedBy) { where.push('r.submitted_by = ?'); args.push(submittedBy); }
    if (managerId) { where.push('r.assigned_manager_id = ?'); args.push(managerId); }
    const order = pendingFirst ? "(r.status = 'pending') DESC, r.submitted_at DESC, r.id" : 'r.submitted_at DESC, r.id';
    return this.db.prepare(`SELECT r.*, p.name AS project_name, s.full_name AS submitted_by_name, m.full_name AS manager_name, d.full_name AS decided_by_name
      FROM publication_requests r JOIN projects p ON p.id = r.project_id
      JOIN users s ON s.id = r.submitted_by JOIN users m ON m.id = r.assigned_manager_id LEFT JOIN users d ON d.id = r.decided_by
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${order} LIMIT ?`).all(...args, limit);
  }

  // Only a pending request changes state here (withdraw, stale).
  setRequestStatus(id, status, now, { staleReason = null } = {}) {
    return Number(this.stmt("UPDATE publication_requests SET status = ?, stale_reason = ?, updated_at = ? WHERE id = ? AND status = 'pending'")
      .run(status, staleReason, now, id).changes);
  }

  // A manager's decision on a pending request (approved | rejected | changes_requested). Returns rows changed.
  decideRequest(id, status, userId, comment, now) {
    return Number(this.stmt(`UPDATE publication_requests SET status = ?, decided_by = ?, decided_at = ?, decision_comment = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'`).run(status, userId, now, comment, now, id).changes);
  }

  setPreviousRequest(id, previousId) {
    this.stmt('UPDATE publication_requests SET previous_request_id = ? WHERE id = ?').run(previousId, id);
  }

  // Every request for one publication, oldest first: its history (decisions.md M5).
  listRequestsForPublication(projectId, publicationRef) {
    return this.stmt(`SELECT r.*, p.name AS project_name, s.full_name AS submitted_by_name, m.full_name AS manager_name, d.full_name AS decided_by_name
      FROM publication_requests r JOIN projects p ON p.id = r.project_id
      JOIN users s ON s.id = r.submitted_by JOIN users m ON m.id = r.assigned_manager_id LEFT JOIN users d ON d.id = r.decided_by
      WHERE r.project_id = ? AND r.publication_ref = ? ORDER BY r.submitted_at, r.rowid`).all(projectId, publicationRef);
  }

  addRequestModules(requestId, modules) {
    const ins = this.stmt('INSERT OR IGNORE INTO request_modules (request_id, data_module_id, rel_path) VALUES (?,?,?)');
    for (const m of modules) ins.run(requestId, m.id, m.rel_path);
  }

  listRequestModules(requestId) {
    return this.stmt(`SELECT rm.request_id, rm.data_module_id, rm.rel_path, dm.dmc, dm.tech_name, dm.info_name, dm.status
      FROM request_modules rm JOIN data_modules dm ON dm.id = rm.data_module_id WHERE rm.request_id = ? ORDER BY dm.dmc`).all(requestId);
  }

  // The most recently submitted request that froze this module.
  newestRequestForModule(dataModuleId) {
    return this.stmt(`SELECT r.* FROM request_modules rm JOIN publication_requests r ON r.id = rm.request_id
      WHERE rm.data_module_id = ? ORDER BY r.submitted_at DESC, r.rowid DESC LIMIT 1`).get(dataModuleId) || null;
  }

  // Status only: the approval flow's change is not an edit of the module (updated_by/at untouched).
  setDataModuleStatus(id, status) {
    this.stmt('UPDATE data_modules SET status = ? WHERE id = ?').run(status, id);
  }

  // Revisions of the document at `relPath` in a project, up to a moment (a snapshot's revision history).
  listRevisionsUntil(projectId, relPath, untilIso, limit = 200) {
    return this.stmt(`SELECT r.id, r.document_id, r.reason, r.created_at, r.rel_path, u.full_name AS created_by_name, b.size
      FROM revisions r JOIN documents d ON d.id = r.document_id LEFT JOIN users u ON u.id = r.created_by JOIN blobs b ON b.hash = r.hash
      WHERE d.project_id = ? AND r.rel_path = ? AND r.created_at <= ? ORDER BY r.id DESC LIMIT ?`).all(projectId, relPath, untilIso, limit);
  }

  // Recent content activity in some projects (team activity, decisions.md M8).
  listContentActivity(projectIds, limit = 500) {
    if (!projectIds.length) return [];
    const ph = projectIds.map(() => '?').join(',');
    return this.db.prepare(`SELECT a.id, a.at, a.actor_id, a.action, a.target_type, a.target_id, a.project_id, a.meta, u.full_name AS actor_name, u.role AS actor_role
      FROM audit_log a JOIN users u ON u.id = a.actor_id
      WHERE a.project_id IN (${ph}) AND (a.action LIKE 'dm.%' OR a.action LIKE 'publication.%' OR a.action LIKE 'graphic.%' OR a.action LIKE 'request.%')
      ORDER BY a.id DESC LIMIT ?`).all(...projectIds, limit);
  }

  listDraftsForProjects(projectIds) {
    if (!projectIds.length) return [];
    const ph = projectIds.map(() => '?').join(',');
    return this.db.prepare(`SELECT user_id, project_id, doc_key, updated_at FROM drafts WHERE project_id IN (${ph})`).all(...projectIds);
  }

  // ---- drafts -------------------------------------------------------------

  putDraft({ userId, projectId, docKey, baseRevision, content, now }) {
    this.stmt(`INSERT INTO drafts (user_id, project_id, doc_key, base_revision, content, size, updated_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(user_id, project_id, doc_key) DO UPDATE SET base_revision = excluded.base_revision, content = excluded.content,
        size = excluded.size, updated_at = excluded.updated_at`)
      .run(userId, projectId, docKey, baseRevision == null ? null : baseRevision, content, Buffer.byteLength(content), now);
  }

  getDraft(userId, projectId, docKey) {
    return this.stmt('SELECT * FROM drafts WHERE user_id = ? AND project_id = ? AND doc_key = ?').get(userId, projectId, docKey) || null;
  }

  deleteDraft(userId, projectId, docKey) {
    return Number(this.stmt('DELETE FROM drafts WHERE user_id = ? AND project_id = ? AND doc_key = ?').run(userId, projectId, docKey).changes);
  }

  listDraftsForUser(userId) {
    return this.stmt(`SELECT d.user_id, d.project_id, d.doc_key, d.base_revision, d.size, d.updated_at, p.name AS project_name
      FROM drafts d JOIN projects p ON p.id = d.project_id WHERE d.user_id = ? ORDER BY d.updated_at DESC`).all(userId);
  }

  // ---- build and validation history --------------------------------------

  recordBuild({ projectId, kind, target = null, userId, ok, ms = null, errorCode = null, now }) {
    this.stmt('INSERT INTO builds (project_id, kind, target, user_id, ok, ms, error_code, at) VALUES (?,?,?,?,?,?,?,?)')
      .run(projectId, kind, target, userId, ok ? 1 : 0, ms == null ? null : Math.round(ms), errorCode, now);
  }

  lastBuild(projectId, kind = 'full') {
    return this.stmt('SELECT b.*, u.full_name AS user_name FROM builds b LEFT JOIN users u ON u.id = b.user_id WHERE b.project_id = ? AND b.kind = ? ORDER BY b.id DESC LIMIT 1')
      .get(projectId, kind) || null;
  }

  recordValidation({ projectId, userId, errors, warnings, modules, now }) {
    this.stmt('INSERT INTO validation_runs (project_id, user_id, errors, warnings, modules, at) VALUES (?,?,?,?,?,?)')
      .run(projectId, userId, errors, warnings, modules, now);
  }

  lastValidation(projectId) {
    return this.stmt('SELECT * FROM validation_runs WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(projectId) || null;
  }

  // ---- notifications ------------------------------------------------------

  addNotification({ userId, kind, title, body = null, link = null, refType = null, refId = null, auditId = null, now }) {
    this.stmt(`INSERT INTO notifications (user_id, kind, title, body, link, ref_type, ref_id, audit_id, created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(userId, kind, title, body, link, refType, refId, auditId, now);
  }

  listNotifications(userId, limit = 30) {
    return this.stmt(`SELECT id, kind, title, body, link, created_at, read_at FROM notifications
      WHERE user_id = ? ORDER BY id DESC LIMIT ?`).all(userId, limit);
  }

  unreadNotificationCount(userId) {
    return this.stmt('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(userId).n;
  }

  markNotificationsRead(userId, ids, now) {
    if (ids && ids.length) {
      const ph = ids.map(() => '?').join(',');
      return Number(this.db.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${ph})`)
        .run(now, userId, ...ids).changes);
    }
    return Number(this.stmt('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now, userId).changes);
  }
}

module.exports = { Store };
