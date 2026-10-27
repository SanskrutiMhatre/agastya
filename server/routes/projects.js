'use strict';
// Projects as governance records (Phase 1): create, list within scope, read,
// and assign or remove Authors. Each project has one owner, an Author or a
// Project Manager (decisions.md R9). The on-disk S1000D workspace is
// scaffolded in Phase 2. Anyone who is not the owner, an assigned Author or
// the administrator receives 404 for every project route.

const crypto = require('node:crypto');
const policy = require('../auth/policy');
const { evaluate, loaders } = require('../auth/authz');
const { body } = require('../http/validate');
const { sendError } = require('../http/errors');

const { ADMIN } = policy.ROLES;

// Project ids become directory names in Phase 2, so they are generated,
// never taken from input.
const newProjectId = () => `prj-${crypto.randomBytes(5).toString('hex')}`;

const projectOut = (p) => ({
  id: p.id, name: p.name, description: p.description, status: p.status,
  owner: { id: p.owner_id, username: p.owner_username, fullName: p.owner_name, role: p.owner_role },
  authorCount: p.author_count != null ? Number(p.author_count) : undefined,
  relation: p.relation || undefined,
  assignedAt: p.assigned_at || undefined,
  createdAt: p.created_at,
});

const memberOut = (m) => ({
  id: m.user_id, username: m.username, fullName: m.full_name, addedAt: m.added_at,
  addedBy: m.added_by_username || null, status: m.disabled_at ? 'disabled' : m.onboarding_pending ? 'pending' : 'active',
});

function register({ app, store, authz, audit, now, clientIp, documents, overrides }) {
  const { can } = authz;
  const nowIso = () => now().toISOString();

  app.get('/api/projects',
    can('project.list'),
    (req, res) => {
      const me = req.auth.user;
      // Administrator: everything. Anyone else: what they own or are assigned to.
      const rows = me.role === ADMIN ? store.listProjects() : store.listProjects({ userId: me.id });
      res.json({ projects: rows.map(projectOut) });
    });

  app.post('/api/projects',
    can('project.create'),
    body({
      name: { type: 'string', required: true, min: 3, max: 80, label: 'Project name' },
      description: { type: 'string', max: 500, label: 'Description' },
    }),
    (req, res) => {
      const me = req.auth.user;
      const name = req.valid.name.replace(/\s+/g, ' ');
      if (store.projectNameTaken(name)) return sendError(res, 409, 'NAME_TAKEN', 'A project with that name already exists.');
      let project;
      try {
        project = store.createProject({ id: newProjectId(), name, description: req.valid.description || '', ownerId: me.id, createdBy: me.id, now: nowIso() });
      } catch (e) {
        if (/UNIQUE/i.test(e.message)) return sendError(res, 409, 'NAME_TAKEN', 'A project with that name already exists.');
        throw e;
      }
      // The S1000D workspace on disk (csdb/, Media/, publication.xml, project.json).
      documents.workspaceFor(project);
      audit({ actorId: me.id, actorUsername: me.username, ip: clientIp(req), action: 'project.created',
        targetType: 'project', targetId: project.id, projectId: project.id, meta: { projectName: project.name, ownerRole: me.role } });
      res.status(201).json({ ok: true, project: projectOut({ ...project, author_count: 0 }) });
    });

  app.get('/api/projects/:id',
    can('project.read', loaders.project),
    (req, res) => {
      const me = req.auth.user;
      const { project } = req.ctx;
      // Each Author's last content action here (an action and a time, never content).
      const last = new Map();
      for (const a of store.listContentActivity([project.id], 300)) if (!last.has(a.actor_id)) last.set(a.actor_id, { action: a.action, at: a.at });
      const members = store.listMembers(project.id).map((m) => ({ ...memberOut(m), lastActivity: last.get(m.user_id || m.id) || null }));
      res.json({
        project: projectOut({ ...project, author_count: members.length }),
        authors: members,
        relation: project.owner_id === me.id ? 'owner' : req.ctx.membership ? 'assigned' : 'oversight',
        permissions: {
          assign: evaluate(me, 'project.assign', req.ctx).ok,
          write: evaluate(me, 'content.write', req.ctx).ok,
          build: evaluate(me, 'content.build', req.ctx).ok,
          drafts: evaluate(me, 'draft.write', req.ctx).ok,
          // The administrator may edit as an override, one document at a time, with a reason (decisions.md V3).
          override: me.role === ADMIN,
        },
      });
    });

  app.get('/api/projects/:id/assignable',
    can('project.assign.list', loaders.project),
    (req, res) => {
      res.json({
        authors: store.listAssignableAuthors(req.ctx.project.id).map((u) => ({
          id: u.id, username: u.username, fullName: u.full_name, status: u.onboarding_pending ? 'pending' : 'active',
        })),
      });
    });

  // For the administrator, assigning and removing are overrides with a written reason (V7).
  const REASON = { type: 'string', max: 1000, label: 'Reason' };
  function memberOverride(req, project, author, action) {
    if (req.auth.user.role !== ADMIN) return null;
    return overrides.record(req, {
      kind: 'members', action, projectId: project.id, targetType: 'user', targetId: author.id, reason: req.valid.reason,
      recipients: [author.id, project.owner_id], meta: { projectName: project.name, username: author.username, added: action === 'project.member.added' },
    });
  }

  app.post('/api/projects/:id/members',
    can('project.assign', loaders.withReason(loaders.project)),
    body({ userId: { type: 'string', required: true, max: 64 }, reason: REASON }),
    (req, res) => {
      const me = req.auth.user;
      const { project } = req.ctx;
      const author = store.getUser(req.valid.userId);
      if (!author || author.role !== policy.ROLES.AUTHOR || author.disabled_at) {
        return sendError(res, 400, 'NOT_AN_AUTHOR', 'Only active Author accounts can be assigned to a project.');
      }
      if (author.id === project.owner_id) {
        return sendError(res, 409, 'ALREADY_OWNER', 'That Author owns this project already.');
      }
      if (!store.addMember(project.id, author.id, me.id, nowIso())) {
        return sendError(res, 409, 'ALREADY_ASSIGNED', 'That Author is already assigned to this project.');
      }
      const overrideId = memberOverride(req, project, author, 'project.member.added');
      audit({ actorId: me.id, actorUsername: me.username, ip: clientIp(req), action: 'project.member.added',
        targetType: 'user', targetId: author.id, projectId: project.id,
        meta: { projectName: project.name, username: author.username, byAdmin: me.role === ADMIN || undefined, overrideId: overrideId || undefined } });
      res.status(201).json({ ok: true, authors: store.listMembers(project.id).map(memberOut) });
    });

  app.delete('/api/projects/:id/members/:userId',
    can('project.assign', loaders.withReason(loaders.project)),
    body({ reason: REASON }),
    (req, res) => {
      const me = req.auth.user;
      const { project } = req.ctx;
      const author = store.getUser(req.params.userId);
      if (!author || !store.removeMember(project.id, author.id)) return sendError(res, 404, 'NOT_FOUND', 'Not found.');
      const overrideId = memberOverride(req, project, author, 'project.member.removed');
      audit({ actorId: me.id, actorUsername: me.username, ip: clientIp(req), action: 'project.member.removed',
        targetType: 'user', targetId: author.id, projectId: project.id,
        meta: { projectName: project.name, username: author.username, byAdmin: me.role === ADMIN || undefined, overrideId: overrideId || undefined } });
      res.json({ ok: true, authors: store.listMembers(project.id).map(memberOut) });
    });
}

module.exports = { register, projectOut, memberOut };
