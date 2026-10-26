import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Tabs, { TabPanel } from '../../components/ui/Tabs.jsx';
import { SearchInput, Select } from '../../components/ui/Field.jsx';
import { Avatar, RoleBadge, StatusBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import SecretReveal from '../../components/ui/SecretReveal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import CreateUserDialog from './CreateUserDialog.jsx';
import ResetRequests from './ResetRequests.jsx';
import useResource from '../../lib/useResource.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate, fmtRelative } from '../../lib/format.js';

export default function UsersPage() {
  const { me, refresh } = useAuth();
  const isAdmin = me.user.role === 'software_admin';
  const toast = useToast();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'resets' ? 'resets' : 'accounts';
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState(null);

  const users = useResource('/api/users');
  const resets = useResource('/api/resets');
  const pendingCount = resets.data ? resets.data.requests.length : 0;

  // Search and filters run client-side over the caller's scope.
  const rows = useMemo(() => {
    const list = users.data ? users.data.users : [];
    const q = search.trim().toLowerCase();
    return list.filter((u) => (!role || u.role === role) && (!status || u.status === status)
      && (!q || u.username.includes(q) || u.fullName.toLowerCase().includes(q)));
  }, [users.data, search, role, status]);

  function onCreated(r) {
    setCreating(false);
    setSecret({ title: 'Account created', username: r.user.username, tempPassword: r.tempPassword, expiresAt: r.tempPasswordExpiresAt, userId: r.user.id });
    toast.success('Account created', `${r.user.fullName} (${r.user.username})`);
    users.reload();
  }

  const filtered = search || role || status;
  return (
    <>
      <PageHeader
        eyebrow={isAdmin ? 'Administration' : 'Team'}
        title={isAdmin ? 'Users' : 'Authors'}
        subtitle={isAdmin ? 'Every account in Agastya. You create Project Managers and Authors.' : 'Author accounts you created. You can reset their passwords.'}
        actions={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>{isAdmin ? 'Create user' : 'Create Author'}</Button>}
      />

      <Tabs idBase="users" value={tab} onChange={(v) => setParams(v === 'resets' ? { tab: 'resets' } : {})}
        tabs={[{ value: 'accounts', label: 'Accounts' }, { value: 'resets', label: 'Reset requests', count: pendingCount }]} />

      <TabPanel idBase="users" value="accounts" active={tab}>
        <Card>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search name or username" label="Search users" className="w-full sm:w-72" />
            {isAdmin ? (
              <div className="w-full sm:w-48">
                <Select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">All roles</option>
                  <option value="software_admin">Software Administrator</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="author">Author</option>
                </Select>
              </div>
            ) : null}
            <div className="w-full sm:w-44">
              <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="pending">Setup pending</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
            <p className="sm:ml-auto text-[13px] text-ink-3" aria-live="polite">
              {users.data ? `${rows.length} of ${users.data.users.length}` : ''}
            </p>
          </div>
          {users.error ? <ErrorState error={users.error} onRetry={users.reload} />
            : users.loading ? <div className="px-4 pb-4"><LoadingBlock rows={5} /></div>
              : (
                <DataTable
                  caption={isAdmin ? 'User accounts' : 'Author accounts'}
                  rows={rows}
                  initialSort={{ key: 'name', dir: 'asc' }}
                  empty={filtered
                    ? <EmptyState icon="search" title="No matching accounts" action={<Button size="sm" onClick={() => { setSearch(''); setRole(''); setStatus(''); }}>Clear filters</Button>} />
                    : <EmptyState icon="users" title="No accounts yet" action={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Create the first one</Button>} />}
                  columns={[
                    {
                      key: 'name', header: 'Name', sortValue: (u) => u.fullName,
                      render: (u) => (
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.fullName} size={30} />
                          <div className="min-w-0">
                            <Link to={`/users/${u.id}`} className="font-medium text-ink hover:text-accent hover:underline">{u.fullName}</Link>
                            <p className="font-mono text-[12px] text-ink-3">{u.username}</p>
                          </div>
                        </div>
                      ),
                    },
                    ...(isAdmin ? [{ key: 'role', header: 'Role', sortValue: (u) => u.role, render: (u) => <RoleBadge role={u.role} />, hideBelow: 'md' }] : []),
                    { key: 'status', header: 'Status', sortValue: (u) => u.status, render: (u) => <StatusBadge status={u.status} /> },
                    ...(isAdmin ? [{ key: 'creator', header: 'Created by', sortValue: (u) => (u.createdBy ? u.createdBy.fullName : ''), render: (u) => <span className="text-ink-2">{u.createdBy ? u.createdBy.fullName : 'Bootstrap'}</span>, hideBelow: 'lg' }] : []),
                    { key: 'projects', header: 'Projects', align: 'right', sortValue: (u) => u.ownedCount + u.projectCount, render: (u) => u.ownedCount + u.projectCount, hideBelow: 'sm' },
                    { key: 'login', header: 'Last sign-in', sortValue: (u) => u.lastLoginAt || '', render: (u) => <span className="text-ink-2">{fmtRelative(u.lastLoginAt)}</span>, hideBelow: 'md' },
                    { key: 'created', header: 'Created', sortValue: (u) => u.createdAt, render: (u) => <span className="text-ink-2">{fmtDate(u.createdAt)}</span>, hideBelow: 'lg' },
                  ]}
                />
              )}
        </Card>
      </TabPanel>

      <TabPanel idBase="users" value="resets" active={tab}>
        <ResetRequests resource={resets} isAdmin={isAdmin} onChanged={() => { users.reload(); refresh(); }} />
      </TabPanel>

      <CreateUserDialog open={creating} onClose={() => setCreating(false)} onCreated={onCreated} isAdmin={isAdmin} />
      <SecretReveal secret={secret} onClose={() => { const id = secret && secret.userId; setSecret(null); if (id) nav(`/users/${id}`); }} />
    </>
  );
}
