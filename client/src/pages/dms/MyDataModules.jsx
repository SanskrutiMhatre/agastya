import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import { Badge, OwnerTag } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import Icon from '../../components/Icon.jsx';
import useResource from '../../lib/useResource.js';

// Data modules live in projects: pick the project whose CSDB you want to work in.
export default function MyDataModules() {
  const { data, loading, error, reload } = useResource('/api/projects');
  return (
    <>
      <PageHeader eyebrow="Authoring" title="Data modules" subtitle="Choose a project to open its data modules (CSDB)." />
      <Card>
        {error ? <ErrorState error={error} onRetry={reload} />
          : loading ? <div className="p-5"><LoadingBlock rows={3} /></div>
            : !data.projects.length ? (
              <EmptyState icon="folder" title="No projects yet">Create a project from the dashboard, or ask a Project Manager to assign you to one.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {data.projects.map((p) => (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}?tab=dms`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2 group">
                      <span className="grid place-items-center h-9 w-9 rounded-md bg-accent-soft text-accent-soft-ink"><Icon name="file" size={18} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink group-hover:text-accent truncate">{p.name}</p>
                        <p className="text-[12px] text-ink-3 flex items-center gap-2"><OwnerTag owner={p.owner} size={16} /></p>
                      </div>
                      {p.relation === 'owner' ? <Badge tone="accent" icon="key">Owner</Badge> : <Badge icon="users">Assigned</Badge>}
                      <Icon name="chevronRight" size={16} className="text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
      </Card>
    </>
  );
}
