import { Link } from 'react-router-dom';
import { Card, CardHeader, PageHeader } from '../../components/ui/Card.jsx';
import StatTile from '../../components/ui/StatTile.jsx';
import ColumnChart from '../../components/ui/ColumnChart.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import { Badge, OwnerTag, RoleBadge, StatusBadge } from '../../components/ui/Badge.jsx';
import { ModuleStatusBadge } from '../../components/ModuleStatusBadge.jsx';
import Icon from '../../components/Icon.jsx';
import useResource from '../../lib/useResource.js';
import { describeAction, fmtRelative, isFailureAction } from '../../lib/format.js';
import { RequestBadge, REQUEST_STATUS } from '../projects/ApprovalCard.jsx';

const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const SHORT = new Intl.DateTimeFormat(undefined, { day: 'numeric', timeZone: 'UTC' });

// Every approval request, by status, and the latest ones; the administrator decides, resets or reassigns from the review screen.
function Submissions({ loading, data }) {
  return (
    <Card>
      <CardHeader title="Submissions and decisions" subtitle="Approval requests across every project"
        actions={<Link to="/approvals" className="text-[13px] text-accent hover:underline">All requests</Link>} />
      <div className="px-5 pb-5">
        {loading || !data ? <LoadingBlock rows={3} /> : !data.total ? <p className="text-[13px] text-ink-3 py-2">No approval requests yet.</p> : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,260px)_1fr]">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] content-start" data-testid="admin-submissions">
              {Object.entries(data.byStatus).map(([k, n]) => (
                <div key={k} className="contents">
                  <dt className="text-ink-3">{(REQUEST_STATUS[k] || { label: k }).label}</dt>
                  <dd className="text-right font-semibold tabular text-ink">{n}</dd>
                </div>
              ))}
            </dl>
            <ul className="divide-y divide-line rounded-md border border-line">
              {data.recent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <Link to={`/approvals/${r.id}`} className="font-medium text-ink hover:text-accent hover:underline">{r.title || r.projectName}</Link>
                    <span className="block text-[12px] text-ink-3">{r.submittedBy.name} to {r.manager.name} · {fmtRelative(r.submittedAt)}</span>
                  </span>
                  <RequestBadge status={r.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

/*
  Organisation-wide oversight (decisions.md V1): requests nobody can decide,
  each Project Manager's queue, each Author's work, and who is working on
  what across every project (Author-owned ones included).
*/
function Stuck({ items }) {
  if (!items || !items.length) return null;
  return (
    <div className="mb-6" data-testid="stuck-requests">
      <Alert tone="danger" title={`${items.length} pending request${items.length === 1 ? '' : 's'} with a disabled Project Manager`}>
        Nobody can decide {items.length === 1 ? 'it' : 'them'} until {items.length === 1 ? 'it is' : 'they are'} reassigned.
        <ul className="mt-2 space-y-1">
          {items.map((r) => (
            <li key={r.id}><Link to={`/approvals/${r.id}`} className="font-medium underline">{r.title || r.projectName}</Link> · {r.projectName} · sent by {r.submittedBy} to {r.manager.name} {fmtRelative(r.submittedAt)}</li>
          ))}
        </ul>
      </Alert>
    </div>
  );
}

function Workload({ loading, o }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <Card>
        <CardHeader title="Project Managers" subtitle="Approval queues and decisions in the last 30 days" />
        {loading || !o ? <div className="px-5 pb-5"><LoadingBlock rows={3} /></div> : (
          <DataTable caption="Project Manager workload" rows={o.managers} initialSort={{ key: 'pending', dir: 'desc' }}
            empty={<EmptyState icon="users" title="No Project Managers yet" />}
            columns={[
              { key: 'name', header: 'Manager', sortValue: (m) => m.fullName, render: (m) => <span className="inline-flex flex-wrap items-center gap-1.5"><Link to={`/users/${m.id}`} className="font-medium text-ink hover:text-accent hover:underline">{m.fullName}</Link>{m.status !== 'active' ? <StatusBadge status={m.status} /> : null}{m.stuck ? <Badge tone="danger" icon="alert">Requests stuck</Badge> : null}</span> },
              { key: 'pending', header: 'Pending', align: 'right', sortValue: (m) => m.pending, render: (m) => <span className={m.pending ? 'font-semibold text-ink' : 'text-ink-3'}>{m.pending}</span> },
              { key: 'oldest', header: 'Oldest', sortValue: (m) => m.oldestPending || '', render: (m) => <span className="text-ink-2">{m.oldestPending ? fmtRelative(m.oldestPending) : '—'}</span>, hideBelow: 'sm' },
              { key: 'decided', header: 'Decided', align: 'right', sortValue: (m) => m.decided30d, render: (m) => m.decided30d, hideBelow: 'md' },
              { key: 'projects', header: 'Projects', align: 'right', sortValue: (m) => m.projects, render: (m) => m.projects, hideBelow: 'md' },
            ]} />
        )}
      </Card>
      <Card>
        <CardHeader title="Authors" subtitle="Projects, modules last saved by them, drafts and requests" />
        {loading || !o ? <div className="px-5 pb-5"><LoadingBlock rows={3} /></div> : (
          <DataTable caption="Author workload" rows={o.authors} initialSort={{ key: 'last', dir: 'desc' }}
            empty={<EmptyState icon="users" title="No Authors yet" />}
            columns={[
              { key: 'name', header: 'Author', sortValue: (a) => a.fullName, render: (a) => <span className="inline-flex flex-wrap items-center gap-1.5"><Link to={`/users/${a.id}`} className="font-medium text-ink hover:text-accent hover:underline">{a.fullName}</Link>{a.status !== 'active' ? <StatusBadge status={a.status} /> : null}</span> },
              { key: 'projects', header: 'Projects', align: 'right', sortValue: (a) => a.projects.owned + a.projects.assigned, render: (a) => <span title={`${a.projects.owned} owned, ${a.projects.assigned} assigned`}>{a.projects.owned + a.projects.assigned}</span> },
              { key: 'modules', header: 'Modules', sortValue: (a) => a.modules.draft + a.modules.in_review + a.modules.approved, render: (a) => <span className="text-[12px] text-ink-2 tabular">{a.modules.draft} draft · {a.modules.in_review} review · {a.modules.approved} approved</span>, hideBelow: 'sm' },
              { key: 'drafts', header: 'Drafts', align: 'right', sortValue: (a) => a.drafts, render: (a) => a.drafts, hideBelow: 'md' },
              { key: 'last', header: 'Last work', sortValue: (a) => a.lastActionAt || '', render: (a) => <span className="text-ink-2">{a.lastActionAt ? fmtRelative(a.lastActionAt) : 'none yet'}</span>, hideBelow: 'md' },
            ]} />
        )}
      </Card>
    </div>
  );
}

function WorkingOn({ loading, o }) {
  const items = o ? o.activity.items.slice(0, 15) : [];
  return (
    <Card>
      <CardHeader title="Who is working on what" subtitle="Each Author's latest work on every project, with unsaved drafts (never their content)" />
      <div className="px-5 pb-5">
        {loading || !o ? <LoadingBlock rows={4} /> : !items.length ? <p className="text-[13px] text-ink-3 py-2">No Author activity yet.</p> : (
          <ul className="divide-y divide-line rounded-md border border-line text-[13px]" data-testid="admin-working-on">
            {items.map((it, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                <span className="font-medium text-ink">{it.author.name}</span>
                <span className="text-ink-2">{it.action}</span>
                <span className="min-w-0 text-ink">{it.target.type === 'dm' ? <span className="font-mono text-[12px]">{it.target.dmc}</span> : it.target.label}</span>
                {it.target.status ? <ModuleStatusBadge status={it.target.status} /> : null}
                <Link to={`/projects/${it.project.id}`} className="text-accent hover:underline">{it.project.name}</Link>
                <span className="text-ink-3">{fmtRelative(it.at)}</span>
                {it.draftSince ? <Badge tone="warn" icon="edit">Unsaved draft since {fmtRelative(it.draftSince)}</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function RoleBreakdown({ users }) {
  const rows = ['software_admin', 'project_manager', 'author'].map((r) => ({ role: r, ...users[r] }));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <caption className="sr-only">Accounts by role and status</caption>
        <thead>
          <tr className="text-ink-3 text-[12px] uppercase tracking-wide">
            <th scope="col" className="text-left font-medium pl-5 pr-3 py-2">Role</th>
            <th scope="col" className="text-right font-medium px-3 py-2">Active</th>
            <th scope="col" className="text-right font-medium px-3 py-2">Pending</th>
            <th scope="col" className="text-right font-medium pl-3 pr-5 py-2">Disabled</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.role} className="border-t border-line">
              <td className="pl-5 pr-3 py-3"><RoleBadge role={r.role} /></td>
              <td className="px-3 py-3 text-right tabular font-medium">{r.active - r.pending}</td>
              <td className="px-3 py-3 text-right tabular text-ink-2">{r.pending}</td>
              <td className="pl-3 pr-5 py-3 text-right tabular text-ink-2">{r.disabled}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityFeed({ items }) {
  if (!items.length) return <EmptyState icon="activity" title="No activity yet" />;
  return (
    <ol className="divide-y divide-line">
      {items.map((a) => {
        const failed = isFailureAction(a.action);
        return (
          <li key={a.id} className="flex items-start gap-3 px-5 py-2.5">
            <span className={`mt-0.5 grid place-items-center h-6 w-6 rounded-full ${failed ? 'bg-danger-soft text-danger' : 'bg-surface-3 text-ink-3'}`}>
              <Icon name={failed ? 'alert' : 'activity'} size={13} />
            </span>
            <div className="min-w-0 flex-1 text-[13px]">
              <p className="text-ink">
                {a.actor ? <span className="font-mono text-[12.5px]">{a.actor}</span> : <span className="text-ink-3">System</span>}{' '}
                <span className={failed ? 'text-danger' : 'text-ink-2'}>{describeAction(a.action, a.meta)}</span>
              </p>
              <p className="text-[11.5px] text-ink-3">{fmtRelative(a.at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useResource('/api/dashboard/admin');
  const over = useResource('/api/admin/oversight');

  if (error) return <Card><ErrorState error={error} onRetry={reload} /></Card>;
  const d = data;
  const pm = d && d.users.project_manager;
  const au = d && d.users.author;
  const totalOk = d ? d.signIns.reduce((n, x) => n + x.ok, 0) : 0;
  const totalFailed = d ? d.signIns.reduce((n, x) => n + x.failed, 0) : 0;

  return (
    <>
      <PageHeader eyebrow="Software Administrator" title="Organisation overview" subtitle="Accounts, projects, approvals and who is working on what across Agastya."
        actions={<><Link to="/audit" className="text-[13px] text-accent hover:underline">Audit log</Link><Link to="/health" className="text-[13px] text-accent hover:underline">System health</Link></>} />
      <Stuck items={over.data && over.data.stuck} />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile loading={loading} label="User accounts" icon="users" to="/users" value={d && d.totals.users}
          hint={d ? `${pm.active + pm.disabled} Project Managers · ${au.active + au.disabled} Authors` : null} />
        <StatTile loading={loading} label="Projects" icon="folder" to="/projects" value={d && d.totals.projects} hint="Active projects" />
        <StatTile loading={loading} label="Active sessions" icon="lock" value={d && d.totals.activeSessions} hint="Signed-in accounts right now" />
        <StatTile loading={loading} label="Pending reset requests" icon="key" to="/users?tab=resets" value={d && d.totals.pendingResets}
          tone={d && d.totals.pendingResets ? 'warn' : undefined} hint="Across all approvers" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5 items-start">
        <Card className="lg:col-span-3">
          <CardHeader title="Sign-ins, last 14 days" subtitle={d ? `${totalOk} successful · ${totalFailed} failed` : 'Loading'} />
          <div className="px-5 pb-4">
            {loading ? <LoadingBlock rows={4} /> : (
              <ColumnChart
                data={d.signIns.map((s) => ({ key: s.day, label: DAY.format(new Date(s.day)), short: SHORT.format(new Date(s.day)), value: s.ok, failed: s.failed }))}
                valueLabel="successful sign-ins"
                tooltip={(x) => (
                  <>
                    <p className="text-ink-2 tabular">{x.value} successful</p>
                    <p className="text-ink-3 tabular">{x.failed} failed</p>
                  </>
                )}
              />
            )}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Accounts by role" subtitle="Exactly one Software Administrator" actions={<Link to="/users" className="text-[13px] text-accent hover:underline">Manage users</Link>} />
          {loading ? <div className="px-5 pb-5"><LoadingBlock rows={3} /></div> : <RoleBreakdown users={d.users} />}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5 items-start">
        <Card className="lg:col-span-3">
          <CardHeader title="Every project" subtitle={d ? `Owned by Project Managers: ${d.ownership.byManagers} · by Authors: ${d.ownership.byAuthors}` : 'Who owns what'} actions={<Link to="/projects" className="text-[13px] text-accent hover:underline">All projects</Link>} />
          {loading || over.loading || !over.data ? <div className="px-5 pb-5"><LoadingBlock rows={3} /></div> : (
            <DataTable
              caption="Projects"
              rows={over.data.projects}
              initialSort={{ key: 'activity', dir: 'desc' }}
              empty={<EmptyState icon="folder" title="No projects yet">Project Managers and Authors create projects.</EmptyState>}
              columns={[
                { key: 'name', header: 'Project', sortValue: (p) => p.name, render: (p) => <Link to={`/projects/${p.id}`} className="font-medium text-ink hover:text-accent hover:underline">{p.name}</Link> },
                { key: 'owner', header: 'Owner', sortValue: (p) => p.owner.fullName, render: (p) => <OwnerTag owner={p.owner} size={20} />, hideBelow: 'sm' },
                { key: 'modules', header: 'Modules', sortValue: (p) => p.modules.draft + p.modules.in_review + p.modules.approved, render: (p) => <span className="text-[12px] text-ink-2 tabular" title="draft · in review · approved">{p.modules.draft} · {p.modules.in_review} · {p.modules.approved}</span>, hideBelow: 'lg' },
                { key: 'request', header: 'Approval', sortValue: (p) => (p.request ? p.request.status : ''), render: (p) => (p.request ? <RequestBadge status={p.request.status} /> : <span className="text-[12px] text-ink-3">Not submitted</span>) },
                { key: 'activity', header: 'Last activity', sortValue: (p) => p.lastActivityAt || '', render: (p) => <span className="text-ink-2">{fmtRelative(p.lastActivityAt)}</span>, hideBelow: 'md' },
              ]}
            />
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Recent activity" subtitle="From the audit log" />
          {loading ? <div className="px-5 pb-5"><LoadingBlock rows={5} /></div> : <div className="pb-2"><ActivityFeed items={d.recentActivity} /></div>}
          <div className="px-5 pb-5"><Link to="/audit" className="text-[13px] text-accent hover:underline">Open the full audit log: filters and CSV export</Link></div>
        </Card>
      </div>

      <div className="mt-6">
        <Submissions loading={loading} data={d && d.submissions} />
      </div>
      <div className="mt-6"><Workload loading={over.loading} o={over.data} /></div>
      <div className="mt-6"><WorkingOn loading={over.loading} o={over.data} /></div>
    </>
  );
}
