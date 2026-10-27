// Role -> navigation. Pure data so it can be unit-tested. The server is the
// authority on every permission; this only decides what is worth showing.

export const ROLE_LABELS = {
  software_admin: 'Software Administrator',
  project_manager: 'Project Manager',
  author: 'Author',
};

const ITEMS = {
  dashboard: { to: '/', label: 'Dashboard', icon: 'grid', end: true },
  users: { to: '/users', label: 'Users', icon: 'users', badge: 'resets' },
  authors: { to: '/users', label: 'Authors', icon: 'users', badge: 'resets' },
  projects: { to: '/projects', label: 'Projects', icon: 'folder' },
  myProjects: { to: '/projects', label: 'My projects', icon: 'folder' },
  dataModules: { to: '/data-modules', label: 'Data modules', icon: 'file' },
  publications: { to: '/publications', label: 'Publications', icon: 'book' },
  approvals: { to: '/approvals', label: 'Approvals', icon: 'check', badge: 'approvals' },
  audit: { to: '/audit', label: 'Audit log', icon: 'list' },
  health: { to: '/health', label: 'System health', icon: 'activity' },
};

const BY_ROLE = {
  software_admin: [
    { heading: 'Overview', items: ['dashboard', 'projects'] },
    { heading: 'Administration', items: ['users', 'approvals', 'audit', 'health'] },
  ],
  project_manager: [
    { heading: 'Overview', items: ['dashboard', 'projects'] },
    { heading: 'Team', items: ['authors', 'approvals'] },
  ],
  author: [
    { heading: 'Overview', items: ['dashboard', 'myProjects'] },
    { heading: 'Authoring', items: ['dataModules', 'publications'] },
  ],
};

export function navFor(role) {
  const sections = BY_ROLE[role] || [];
  return sections.map((s) => ({ heading: s.heading, items: s.items.map((k) => ({ key: k, ...ITEMS[k] })) }));
}

// Every path a role's navigation can lead to (for the route guard tests).
export function pathsFor(role) {
  return navFor(role).flatMap((s) => s.items.map((i) => i.to));
}
