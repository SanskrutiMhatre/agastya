import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, PageHeader } from '../../components/ui/Card.jsx';
import StatTile from '../../components/ui/StatTile.jsx';
import Button from '../../components/ui/Button.jsx';
import { Badge, OwnerTag } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import NewProjectDialog from '../../components/NewProjectDialog.jsx';
import Icon from '../../components/Icon.jsx';
import useResource from '../../lib/useResource.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate, fmtRelative } from '../../lib/format.js';
import { RequestBadge } from '../projects/ApprovalCard.jsx';

const STATUS = { draft: 'Draft', in_review: 'In review', approved: 'Approved' };

function draftLink(d) {
  if (d.key.startsWith('dm-')) return `/projects/${d.projectId}/dms/${d.key.slice(3)}`;
  return `/projects/${d.projectId}?tab=publication`;
}
const draftTitle = (d) => (d.key.startsWith('dm-') ? 'Data module' : d.key === 'publication' ? 'Publication module (XML)' : 'Publication (builder)');

/*
  The Author dashboard (PROMPT.md Phase 2): my projects, my data modules by
  status, my publications, drafts, validation issues and the status of my
  approval requests.
*/
export default function AuthorDashboard() {
  const { me } = useAuth();
  const { data, loading, error, reload } = useResource('/api/dashboard/author');
  const [creating, setCreating] = useState(false);
  if (error) return <Card><ErrorState error={error} onRetry={reload} /></Card>;
  const d = data;
  const first = me.user.fullName.split(' ')[0];
  const t = d ? d.totals : null;

  return (
    <>
      <PageHeader eyebrow="Author" title={`Welcome, ${first}`}
        subtitle="Your projects, data modules, publications and approval requests."
        actions={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Create project</Button>} />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile loading={loading} label="My projects" icon="folder" to="/projects" value={t && t.projects}
          hint={t ? `${t.owned} owned · ${t.assigned} assigned` : null} />
        <StatTile loading={loading} label="My data modules" icon="file" to="/data-modules" value={t && t.dataModules}
          hint={d ? Object.entries(STATUS).map(([k, l]) => `${d.dataModules.byStatus[k] || 0} ${l.toLowerCase()}`).join(' · ') : null} />
        <StatTile loading={loading} label="My publications" icon="book" to="/publications" value={t && t.publications}
          hint={t ? `${t.pendingRequests} pending approval` : null} />
        <StatTile loading={loading} label="Validation issues" icon="alert" tone={t && t.validationErrors ? 'warn' : undefined} value={t && t.validationErrors}
          hint={t ? `${t.validationWarnings} warnings${t.unvalidated ? ` · ${t.unvalidated} project${t.unvalidated === 1 ? '' : 's'} not validated yet` : ''}` : null} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5 items-start">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader title="My projects" subtitle="Projects you own or have been assigned to"
              actions={<Button size="sm" icon="plus" onClick={() => setCreating(true)}>New</Button>} />
            {loading ? <div className="px-5 pb-5"><LoadingBlock rows={3} /></div>
              : d.projects.length ? (
                <ul className="divide-y divide-line border-t border-line">
                  {d.projects.map((p) => {
                    const pub = d.publications.find((x) => x.projectId === p.id);
                    const val = d.validation.find((x) => x.projectId === p.id);
                    return (
                      <li key={p.id}>
                        <Link to={`/projects/${p.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2 group">
                          <span className="grid place-items-center h-9 w-9 rounded-md bg-accent-soft text-accent-soft-ink"><Icon name="folder" size={18} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-ink group-hover:text-accent truncate">{p.name}</p>
                              {p.relation === 'owner' ? <Badge tone="accent" icon="key">Owner</Badge> : <Badge icon="users">Assigned</Badge>}
                              {pub && pub.request ? <RequestBadge status={pub.request.status} /> : null}
                            </div>
                            <p className="text-[12px] text-ink-3 flex flex-wrap items-center gap-x-3 mt-0.5">
                              {p.relation === 'owner' ? <span>Created {fmtDate(p.createdAt)}</span> : <><OwnerTag owner={p.owner} size={16} /><span>Assigned {fmtDate(p.assignedAt)}</span></>}
                              {val ? <span>{val.modules} module{val.modules === 1 ? '' : 's'}</span> : null}
                              {val && val.run ? <span className={val.run.errors ? 'text-danger' : ''}>{val.run.errors} error{val.run.errors === 1 ? '' : 's'} at last validation</span> : null}
                            </p>
                          </div>
                          <Icon name="chevronRight" size={16} className="text-ink-3" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon="folder" title="No projects yet"
                  action={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Create your first project</Button>}>
                  Create your own project, or a Project Manager can assign you to one.
                </EmptyState>
              )}
          </Card>

          <Card>
            <CardHeader title="Recent data modules" subtitle="Modules you created or last saved" />
            {loading ? <div className="px-5 pb-5"><LoadingBlock rows={3} /></div> : d.dataModules.recent.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {d.dataModules.recent.map((m) => (
                  <li key={m.id}>
                    <Link to={`/projects/${m.projectId}/dms/${m.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                      <Icon name="file" size={16} className="text-ink-3" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] text-ink truncate">{m.techName}{m.infoName ? ` – ${m.infoName}` : ''}</p>
                        <p className="font-mono text-[11.5px] text-ink-3 truncate">{m.dmc} · {m.projectName}</p>
                      </div>
                      <Badge>{STATUS[m.status] || m.status}</Badge>
                      <span className="text-[12px] text-ink-3 hidden sm:inline">{fmtRelative(m.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 pb-5 text-[13px] text-ink-3">Nothing yet. Open a project and create a data module.</p>}
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Approval requests" subtitle="Publications you submitted" />
            {loading ? <div className="px-5 pb-5"><LoadingBlock rows={2} /></div> : d.requests.length ? (
              <ul className="divide-y divide-line border-t border-line" data-testid="dashboard-requests">
                {d.requests.map((r) => (
                  <li key={r.id}>
                    <Link to={`/projects/${r.projectId}?tab=publication`} className="block px-5 py-3 hover:bg-surface-2">
                      <div className="flex flex-wrap items-center gap-2"><RequestBadge status={r.status} /><span className="text-[13px] text-ink truncate">{r.projectName}</span></div>
                      <p className="text-[12px] text-ink-3 mt-0.5">To {r.manager.name} · {fmtRelative(r.submittedAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 pb-5 text-[13px] text-ink-3">None yet. Submit a publication from its project's Publication & PDF tab.</p>}
          </Card>
          <Card>
            <CardHeader title="Drafts" subtitle="Unsaved work, autosaved while you edit" />
            {loading ? <div className="px-5 pb-5"><LoadingBlock rows={2} /></div> : d.drafts.length ? (
              <ul className="divide-y divide-line border-t border-line" data-testid="dashboard-drafts">
                {d.drafts.map((x) => (
                  <li key={`${x.projectId}-${x.key}`}>
                    <Link to={draftLink(x)} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                      <Icon name="edit" size={16} className="text-ink-3" />
                      <div className="min-w-0 flex-1"><p className="text-[13px] text-ink truncate">{draftTitle(x)}</p><p className="text-[12px] text-ink-3 truncate">{x.projectName}</p></div>
                      <span className="text-[12px] text-ink-3">{fmtRelative(x.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 pb-5 text-[13px] text-ink-3">No unsaved drafts.</p>}
          </Card>
        </div>
      </div>

      <NewProjectDialog open={creating} onClose={() => setCreating(false)} onCreated={() => reload()} role="author" />
    </>
  );
}
