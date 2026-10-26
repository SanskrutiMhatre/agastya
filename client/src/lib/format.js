// Display formatting shared by every screen.

const dtf = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
const dttf = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export const fmtDate = (iso) => (iso ? dtf.format(new Date(iso)) : '—');
export const fmtDateTime = (iso) => (iso ? dttf.format(new Date(iso)) : '—');

export function fmtRelative(iso) {
  if (!iso) return 'never';
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return fmtDate(iso);
}

export const fmtNumber = (n) => (n == null ? '—' : new Intl.NumberFormat(undefined, { notation: n >= 10000 ? 'compact' : 'standard' }).format(n));

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// Audit actions in plain language for the activity feed.
const ACTIONS = {
  'auth.login': () => 'signed in',
  'auth.login.failed': (m) => (m && m.reason === 'unknown-user' ? `failed sign-in for unknown user ${m.username || ''}`.trim() : 'failed sign-in'),
  'auth.logout': () => 'signed out',
  'auth.password.changed': () => 'changed their password',
  'auth.password.change_failed': () => 'failed a password change',
  'auth.onboarding.completed': () => 'completed first sign-in setup',
  'auth.session.revoked': () => 'revoked a session',
  'auth.sessions.revoked': (m) => `signed ${m && m.username} out everywhere`,
  'user.bootstrap_admin_created': () => 'Software Administrator created by bootstrap',
  'user.created': (m) => `created ${m && m.role === 'project_manager' ? 'Project Manager' : 'Author'} ${m && m.username}`,
  'user.updated': (m) => `renamed ${m && m.username}`,
  'user.role.changed': (m) => `changed ${m && m.username} to ${m && m.to === 'project_manager' ? 'Project Manager' : 'Author'}`,
  'user.disabled': (m) => `disabled ${m && m.username}`,
  'user.enabled': (m) => `enabled ${m && m.username}`,
  'user.temp_password_issued': (m) => `issued a temporary password to ${m && m.username}`,
  'reset.requested': () => 'requested a password reset',
  'reset.requested.admin': () => 'requested an administrator password reset',
  'reset.approved': (m) => `approved a password reset for ${m && m.username}`,
  'reset.rejected': () => 'declined a password reset',
  'project.created': (m) => `created project ${m && m.projectName}`,
  'project.member.added': (m) => `assigned ${m && m.username} to ${m && m.projectName}`,
  'project.member.removed': (m) => `removed ${m && m.username} from ${m && m.projectName}`,
  'dm.created': () => 'created a data module',
  'dm.imported': () => 'imported a data module',
  'dm.saved': () => 'saved a data module',
  'dm.renamed': () => 'renamed a data module',
  'dm.deleted': () => 'deleted a data module',
  'dm.restored': () => 'restored a data module',
  'publication.saved': () => 'saved the publication module',
  'publication.imported': () => 'imported a publication module',
  'publication.built': () => 'built the PDF',
  'graphic.uploaded': () => 'uploaded a graphic',
  'request.submitted': (m) => `${m.resubmission ? 'resubmitted' : 'submitted'} ${m.projectName || 'a publication'} for approval`,
  'request.decided': (m) => `${{ approved: 'approved', rejected: 'rejected', changes_requested: 'requested changes to' }[m.outcome] || 'decided'} ${m.projectName || 'a publication'}`,
  'request.withdrawn': (m) => `withdrew the request for ${m.projectName || 'a publication'}`,
  'request.stale': (m) => `request for ${m.projectName || 'a publication'} went out of date`,
};

export function describeAction(action, meta) {
  const f = ACTIONS[action];
  return f ? f(meta || {}) : action;
}

export const isFailureAction = (action) => /failed/.test(action);
