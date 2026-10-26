import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import Icon from '../../components/Icon.jsx';
import useResource from '../../lib/useResource.js';
import { fmtRelative } from '../../lib/format.js';
import { RequestBadge } from './ApprovalCard.jsx';

// Each project has one publication: its size, last build and approval status.
export default function MyPublications() {
  const { data, loading, error, reload } = useResource('/api/dashboard/author');
  return (
    <>
      <PageHeader eyebrow="Authoring" title="Publications" subtitle="The publication of each of your projects: what it contains, when it was last built, and its approval status." />
      <Card>
        {error ? <ErrorState error={error} onRetry={reload} />
          : loading ? <div className="p-5"><LoadingBlock rows={3} /></div>
            : !data.publications.length ? (
              <EmptyState icon="book" title="No publications yet">Create a project from the dashboard, or ask a Project Manager to assign you to one.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {data.publications.map((p) => (
                  <li key={p.projectId}>
                    <Link to={`/projects/${p.projectId}?tab=publication`} className="flex flex-wrap items-center gap-4 px-5 py-3.5 hover:bg-surface-2 group">
                      <span className="grid place-items-center h-9 w-9 rounded-md bg-accent-soft text-accent-soft-ink"><Icon name="book" size={18} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink group-hover:text-accent truncate">{p.projectName}</p>
                        <p className="text-[12px] text-ink-3">
                          {p.entries ? `${p.entries.dms} module${p.entries.dms === 1 ? '' : 's'} in ${p.entries.folders} chapter${p.entries.folders === 1 ? '' : 's'}` : 'publication.xml cannot be read'}
                          {' · '}{p.lastBuild ? `${p.lastBuild.ok ? 'built' : 'build failed'} ${fmtRelative(p.lastBuild.at)}` : 'not built yet'}
                        </p>
                      </div>
                      {p.request ? <RequestBadge status={p.request.status} /> : <Badge>Not submitted</Badge>}
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
