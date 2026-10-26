'use strict';
// Notifications derived from audit actions. Each mapping names who should
// hear about an event; the audit row is the single source, so no route has
// to remember to notify anyone. Later phases add submission, decision and
// admin-override mappings here.

function createNotifier({ store, now = () => new Date() }) {
  const at = () => now().toISOString();

  const MAPPINGS = {
    'reset.requested': (r) => r.meta && r.meta.approverId && [{
      userId: r.meta.approverId, kind: 'reset', title: 'Password reset requested',
      body: `${r.meta.username} asked for a password reset.`, link: '/users?tab=resets',
      refType: 'reset', refId: r.target_id || r.targetId,
    }],
    'user.temp_password_issued': (r) => [{
      userId: r.targetId, kind: 'password', title: 'Your password was reset',
      body: `A temporary password was issued by ${r.actorUsername || 'an administrator'}.`, link: null,
      refType: 'user', refId: r.targetId,
    }],
    'reset.rejected': (r) => [{
      userId: r.targetId, kind: 'password', title: 'Password reset request declined',
      body: `${r.actorUsername} declined your password reset request.`, link: null,
      refType: 'user', refId: r.targetId,
    }],
    'auth.password.changed': (r) => [{
      userId: r.actorId, kind: 'security', title: 'Your password was changed',
      body: 'If this was not you, contact your Project Manager or the Software Administrator.', link: null,
      refType: 'user', refId: r.actorId,
    }],
    'project.member.added': (r) => [{
      userId: r.targetId, kind: 'project', title: `Assigned to ${r.meta.projectName}`,
      body: `${r.actorUsername} added you to this project.`, link: `/projects/${r.projectId}`,
      refType: 'project', refId: r.projectId,
    }],
    'project.member.removed': (r) => [{
      userId: r.targetId, kind: 'project', title: `Removed from ${r.meta.projectName}`,
      body: `${r.actorUsername} removed you from this project.`, link: null,
      refType: 'project', refId: r.projectId,
    }],
    'user.role.changed': (r) => [{
      userId: r.targetId, kind: 'account', title: 'Your role changed',
      body: `Your role is now ${String(r.meta.to).replace('_', ' ')}.`, link: '/',
      refType: 'user', refId: r.targetId,
    }],
    // Publication requests (checkpoint 2b). The manager's link opens the request (review screen: Phase 3).
    'request.submitted': (r) => r.meta && [{
      userId: r.meta.managerId, kind: 'request',
      title: r.meta.resubmission ? `Resubmitted for approval: ${r.meta.title || r.meta.projectName}` : `Approval requested: ${r.meta.title || r.meta.projectName}`,
      body: r.meta.resubmission
        ? `${r.meta.authorName || r.actorUsername} resubmitted ${r.meta.projectName} after ${r.meta.resubmission === 'rejected' ? 'a rejection' : 'changes were requested'}. The earlier comments are in its history.`
        : `${r.meta.authorName || r.actorUsername} submitted ${r.meta.projectName} for your approval.`,
      link: `/approvals/${r.targetId}`,
      refType: 'request', refId: r.targetId,
    }],
    // Phase 3: every decision, to the Author who submitted (decisions.md M9).
    'request.decided': (r) => r.meta && [{
      userId: r.meta.authorId, kind: 'request',
      title: `${{ approved: 'Approved', rejected: 'Rejected', changes_requested: 'Changes requested' }[r.meta.outcome] || 'Decided'}: ${r.meta.title || r.meta.projectName}`,
      body: `${r.meta.managerName || r.actorUsername} ${{ approved: 'approved', rejected: 'rejected', changes_requested: 'requested changes to' }[r.meta.outcome] || 'decided'} ${r.meta.projectName}. Open the project to read the comment.`,
      link: `/projects/${r.projectId}?tab=publication`,
      refType: 'request', refId: r.targetId,
    }],
    // An Author disabled by their manager or the administrator: the owners of the other projects they work on hear of it (M7).
    'user.disabled': (r) => {
      const projects = store.listProjectsForMember(r.targetId) || [];
      const owners = new Map();
      for (const p of projects) if (p.owner_id && p.owner_id !== r.actorId) owners.set(p.owner_id, [...(owners.get(p.owner_id) || []), p.name]);
      return [...owners].map(([userId, names]) => ({
        userId, kind: 'account', title: `Author disabled: ${(r.meta && r.meta.username) || 'an Author'}`,
        body: `${r.actorUsername || 'Their manager'} disabled this account. It worked on ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}.`,
        link: null, refType: 'user', refId: r.targetId,
      }));
    },
    'request.withdrawn': (r) => r.meta && [{
      userId: r.meta.managerId, kind: 'request', title: `Request withdrawn: ${r.meta.projectName}`,
      body: `${r.meta.authorName || r.actorUsername} withdrew the approval request.`, link: null,
      refType: 'request', refId: r.targetId,
    }],
    'request.stale': (r) => r.meta && [r.meta.authorId, r.meta.managerId].filter(Boolean).map((userId) => ({
      userId, kind: 'request', title: `Request out of date: ${r.meta.projectName}`,
      body: 'The publication changed after it was submitted, so the request is stale and must be submitted again.',
      link: userId === r.meta.authorId ? `/projects/${r.projectId}?tab=publication` : null,
      refType: 'request', refId: r.targetId,
    })),
    // Oversight: the administrator hears when a Project Manager creates an Author.
    'user.created': (r) => {
      if (!r.meta || r.meta.creatorRole !== 'project_manager') return null;
      const admin = store.getAdmin();
      return admin && [{
        userId: admin.id, kind: 'account', title: 'New Author account',
        body: `${r.actorUsername} created ${r.meta.username}.`, link: `/users/${r.targetId}`,
        refType: 'user', refId: r.targetId,
      }];
    },
  };

  return function notify(auditId, row) {
    const map = MAPPINGS[row.action];
    if (!map) return;
    const list = map(row) || [];
    for (const n of list) {
      if (!n.userId) continue;
      store.addNotification({ ...n, auditId, now: at() });
    }
  };
}

module.exports = { createNotifier };
