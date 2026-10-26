import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, PageHeader } from '../../components/ui/Card.jsx';
import StatTile from '../../components/ui/StatTile.jsx';
import Button from '../../components/ui/Button.jsx';
import { Avatar, Badge, StatusBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from '../../components/ui/States.jsx';
import NewProjectDialog from '../../components/NewProjectDialog.jsx';
import Icon from '../../components/Icon.jsx';
import useResource from '../../lib/useResource.js';
import { fmtDate, fmtRelative } from '../../lib/format.js';
import { RequestBadge } from '../projects/ApprovalCard.jsx';
import { ModuleStatusBadge } from '../../components/ModuleStatusBadge.jsx';

function ProjectCard({ p }) {
  return (
    <Card as="article" className="flex flex-col">
      <div className="px-5 pt-4 pb-3 border-b border-line">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-ink truncate"><Link to={`/projects/${p.id}`} className="hover:text-accent hover:underline">{p.name}</Link></h3>
            <p className="font-mono text-[11.5px] text-ink-3 mt-0.5 truncate">{p.id}</p>
          </div>
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[12px] font-medium text-ink-2 tabular whitespace-nowrap">{p.authors.length} {p.authors.length === 1 ? 'Author' : 'Authors'}</span>
        </div>
        {p.description ? <p className="mt-2 text-[13px] text-ink-2 line-clamp-2">{p.description}</p> : null}
      </div>
      <div className="flex-1 px-5 py-3">
        {p.authors.length ? (
          <ul className="space-y-2" aria-label={`Authors on ${p.name}`}>
            {p.authors.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center gap-2.5">
                <Avatar name={a.fullName} size={26} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{a.fullName}</span>
                {a.status !== 'active' ? <StatusBadge status={a.status} /> : null}
              </li>
            ))}
            {p.authors.length > 5 ? <li className="text-[12px] text-ink-3 pl-9">and {p.authors.length - 5} more</li> : null}
          </ul>
        ) : <p className="text-[13px] text-ink-3 py-2">No Authors assigned yet.</p>}
      </div>
      <div className="px-5 py-3 border-t border-line bg-surface-2 rounded-b-lg flex justify-between items-center">
        <span className="text-[12px] text-ink-3">Created {fmtDate(p.createdAt)}</span>
        <Link to={`/projects/${p.id}`} className="text-[13px] font-medium text-accent hover:underline inline-flex items-center gap-1">Manage<Icon name="chevronRight" size={14} /></Link>
      </div>
    </Card>
  );
}

function PendingRequests({ loading, requests, total }) {
  return (
    <Card>
      <CardHeader title="Pending approval requests" subtitle="Publications sent to you for a decision"
        actions={<Link to="/approvals" className="text-[13px] text-accent hover:underline">Open the queue</Link>} />
      <div className="px-5 pb-5">
        {loading ? <LoadingBlock rows={3} /> : !requests.length ? <p className="text-[13px] text-ink-3 py-2">Nothing is waiting for you.</p> : (
          <ul className="divide-y divide-line rounded-md border border-line" data-testid="dashboard-pending">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[13px]">
                <span className="min-w-0">
                  <Link to={`/approvals/${r.id}`} className="font-medium text-ink hover:text-accent hover:underline">{r.title || r.projectName}</Link>
                  <span className="block text-[12px] text-ink-3">{r.projectName} · {r.submittedBy.name} · {fmtRelative(r.submittedAt)}{r.previousRequestId ? ' · resubmission' : ''}</span>
                </span>
                <RequestBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
        {total > requests.length ? <p className="mt-2 text-[12px] text-ink-3">and {total - requests.length} more in the queue</p> : null}
      </div>
    </Card>
  );
}

/*
  Team activity (decisions.md M8): projects you own only. Who last did what,
  when, the module's status, and whether an unsaved draft exists and since
  when; never the draft's content.
*/
function TeamActivity({ loading, activity }) {
  return (
    <Card>
      <CardHeader title="Team activity" subtitle="Authors on the projects you own" />
      <div className="px-5 pb-5 space-y-4">
        {loading || !activity ? <LoadingBlock rows={3} /> : (
          <>
            {activity.authors.length ? (
              <ul className="flex flex-wrap gap-2" aria-label="Authors" data-testid="team-authors">
                {activity.authors.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-full border border-line pl-1 pr-3 py-1 text-[12.5px]">
                    <Avatar name={a.name} size={22} />
                    <span className="text-ink">{a.name}</span>
                    <span className="text-ink-3">{a.lastAt ? fmtRelative(a.lastAt) : 'no activity yet'}</span>
                    {a.drafts ? <Badge tone="warn" icon="edit">{a.drafts} unsaved</Badge> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {!activity.items.length ? <p className="text-[13px] text-ink-3">No Author activity on your projects yet.</p> : (
              <ul className="divide-y divide-line rounded-md border border-line max-h-96 overflow-y-auto" data-testid="team-activity">
                {activity.items.slice(0, 20).map((it, i) => (
                  <li key={i} className="px-3 py-2.5 text-[13px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0"><span className="font-medium text-ink">{it.author.name}</span> <span className="text-ink-2">{it.action}</span> <span className="text-ink">{it.target.label}</span></span>
                      {it.target.status ? <ModuleStatusBadge status={it.target.status} /> : null}
                    </div>
                    <p className="text-[12px] text-ink-3">
                      {it.project.name} · {fmtRelative(it.at)}
                      {it.draftSince ? <span className="text-warn"> · unsaved draft since {fmtRelative(it.draftSince)}</span> : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export default function ManagerDashboard() {
  const { data, loading, error, reload } = useResource('/api/dashboard/manager');
  const [creating, setCreating] = useState(false);

  if (error) return <Card><ErrorState error={error} onRetry={reload} /></Card>;
  const d = data;

  return (
    <>
      <PageHeader eyebrow="Project Manager" title="Your projects and team"
        subtitle="Projects you manage, the Authors assigned to them, and requests waiting on you."
        actions={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New project</Button>} />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile loading={loading} label="Projects" icon="folder" to="/projects" value={d && d.totals.projects} />
        <StatTile loading={loading} label="Assigned Authors" icon="users" value={d && d.totals.assignedAuthors} hint="Across your projects" />
        <StatTile loading={loading} label="Authors you created" icon="edit" to="/users" value={d && d.totals.authorsCreated} />
        <StatTile loading={loading} label="Reset requests" icon="key" to="/users?tab=resets" value={d && d.totals.pendingResets}
          tone={d && d.totals.pendingResets ? 'warn' : undefined} hint="Waiting for your decision" />
        <StatTile className="sm:col-span-2 xl:col-span-1" loading={loading} label="Approval requests" icon="check" to="/approvals" value={d && d.totals.pendingRequests}
          tone={d && d.totals.pendingRequests ? 'warn' : undefined} hint="Waiting for your decision" />
      </div>

      <section className="mt-8" aria-labelledby="projects-h">
        <div className="flex items-center justify-between mb-3">
          <h2 id="projects-h" className="text-[15px] font-semibold">Projects</h2>
          {d && d.projects.length ? <Link to="/projects" className="text-[13px] text-accent hover:underline">View as table</Link> : null}
        </div>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div>
        ) : d.projects.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{d.projects.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
        ) : (
          <Card>
            <EmptyState icon="folder" title="No projects yet" action={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Create your first project</Button>}>
              Create a project, then assign Authors to it from the project page.
            </EmptyState>
          </Card>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <PendingRequests loading={loading} requests={d ? d.pendingRequests : []} total={d ? d.totals.pendingRequests : 0} />
        <TeamActivity loading={loading} activity={d ? d.teamActivity : null} />
      </section>

      <NewProjectDialog open={creating} onClose={() => setCreating(false)} onCreated={() => reload()} />
    </>
  );
}
