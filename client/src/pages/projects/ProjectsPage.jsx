import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { SearchInput } from '../../components/ui/Field.jsx';
import { Badge, OwnerTag } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import NewProjectDialog from '../../components/NewProjectDialog.jsx';
import useResource from '../../lib/useResource.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate } from '../../lib/format.js';

const SUBTITLE = {
  software_admin: 'Every project in the organisation and who owns it.',
  project_manager: 'Projects you own. Projects owned by Authors are visible only to their owner and assigned Authors.',
  author: 'Projects you own or are assigned to. Other projects are not visible to you.',
};

export default function ProjectsPage() {
  const { me } = useAuth();
  const role = me.user.role;
  const { data, loading, error, reload } = useResource('/api/projects');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ? data.projects : []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.owner.fullName.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <>
      <PageHeader eyebrow="Projects" title={role === 'author' ? 'My projects' : 'Projects'} subtitle={SUBTITLE[role]}
        actions={role !== 'software_admin' ? <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New project</Button> : null} />
      <Card>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search projects or managers" label="Search projects" className="w-full sm:w-80" />
          <p className="sm:ml-auto text-[13px] text-ink-3" aria-live="polite">{data ? `${rows.length} of ${data.projects.length}` : ''}</p>
        </div>
        {error ? <ErrorState error={error} onRetry={reload} />
          : loading ? <div className="px-4 pb-4"><LoadingBlock rows={4} /></div>
            : (
              <DataTable
                caption="Projects"
                rows={rows}
                initialSort={{ key: 'name', dir: 'asc' }}
                empty={search
                  ? <EmptyState icon="search" title="No matching projects" />
                  : <EmptyState icon="folder" title="No projects yet"
                      action={role !== 'software_admin' ? <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Create a project</Button> : null}>
                      {role === 'author' ? 'Create your own project, or wait to be assigned to one.' : role === 'software_admin' ? 'Project Managers and Authors create projects.' : null}
                    </EmptyState>}
                columns={[
                  { key: 'name', header: 'Project', sortValue: (p) => p.name, render: (p) => (
                    <div>
                      <Link to={`/projects/${p.id}`} className="font-medium text-ink hover:text-accent hover:underline">{p.name}</Link>
                      <p className="font-mono text-[11.5px] text-ink-3">{p.id}</p>
                    </div>
                  ) },
                  { key: 'owner', header: 'Owner', sortValue: (p) => p.owner.fullName, hideBelow: 'sm', render: (p) => <OwnerTag owner={p.owner} /> },
                  ...(role === 'author' ? [{ key: 'relation', header: 'Your role', sortValue: (p) => p.relation,
                    render: (p) => (p.relation === 'owner' ? <Badge tone="accent" icon="key">Owner</Badge> : <Badge icon="users">Assigned</Badge>) }] : []),
                  { key: 'authors', header: 'Authors', align: 'right', sortValue: (p) => p.authorCount, render: (p) => p.authorCount },
                  { key: 'created', header: 'Created', sortValue: (p) => p.createdAt, render: (p) => <span className="text-ink-2">{fmtDate(p.createdAt)}</span>, hideBelow: 'md' },
                ]}
              />
            )}
      </Card>
      <NewProjectDialog open={creating} onClose={() => setCreating(false)} onCreated={() => reload()} role={role} />
    </>
  );
}
