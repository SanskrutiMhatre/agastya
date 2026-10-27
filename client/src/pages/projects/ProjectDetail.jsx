import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, DetailList, PageHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { Field, Select } from '../../components/ui/Field.jsx';
import { Avatar, Badge, Mono, OwnerTag, StatusBadge } from '../../components/ui/Badge.jsx';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog.jsx';
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import OverrideDialog from '../../components/OverrideDialog.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import Icon from '../../components/Icon.jsx';
import useResource from '../../lib/useResource.js';
import Tabs, { TabPanel } from '../../components/ui/Tabs.jsx';
import DataModulesTab from '../dms/DataModulesTab.jsx';
import GraphicsTab from './GraphicsTab.jsx';
import PublicationTab from './PublicationTab.jsx';
import { del, get, post } from '../../api.js';
import { describeAction, fmtDate, fmtRelative } from '../../lib/format.js';

// The administrator assigns as an override: the reason is asked in OverrideDialog (decisions.md V7).
function AssignDialog({ open, onClose, projectId, onAssigned, asAdmin = false }) {
  const [authors, setAuthors] = useState(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open) return;
    setChoice(''); setError(null); setAuthors(null);
    get(`/api/projects/${projectId}/assignable`).then((r) => setAuthors(r.authors)).catch((e) => setError(e.message));
  }, [open, projectId]);

  async function submit(e) {
    e.preventDefault();
    if (!choice) { setError('Choose an Author.'); return; }
    setBusy(true); setError(null);
    try {
      const r = await post(`/api/projects/${projectId}/members`, { userId: choice });
      onAssigned(r.authors, authors.find((a) => a.id === choice));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const picker = (
    <>
      {error ? <Alert>{error}</Alert> : null}
      {authors == null && !error ? <LoadingBlock rows={1} /> : null}
      {authors && !authors.length ? <Alert tone="info">Every active Author is already on this project. Create an Author account first.</Alert> : null}
      {authors && authors.length ? (
        <Field label="Author" required>
          {(p) => (
            <Select {...p} value={choice} onChange={(e) => setChoice(e.target.value)} autoFocus>
              <option value="">Select an Author…</option>
              {authors.map((a) => <option key={a.id} value={a.id}>{a.fullName} ({a.username}){a.status === 'pending' ? ' · setup pending' : ''}</option>)}
            </Select>
          )}
        </Field>
      ) : null}
    </>
  );
  if (asAdmin) {
    return (
      <OverrideDialog open={open} onClose={onClose} title="Assign an Author (override)" confirmLabel="Assign" valid={!!choice}
        description="The Author gains access to this project only." people="the Author and the project's owner"
        onSubmit={async (reason) => {
          if (!choice) throw new Error('Choose an Author.');
          const r = await post(`/api/projects/${projectId}/members`, { userId: choice, reason });
          onAssigned(r.authors, authors.find((a) => a.id === choice));
        }}>
        {picker}
      </OverrideDialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title="Assign an Author" description="The Author gains access to this project only. They are notified."
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" type="submit" form="assign" loading={busy} disabled={!authors || !authors.length}>Assign</Button></>}>
      <form id="assign" onSubmit={submit} className="space-y-3" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        {authors == null && !error ? <LoadingBlock rows={1} /> : null}
        {authors && !authors.length ? <Alert tone="info">Every active Author is already on this project. Create an Author account first.</Alert> : null}
        {authors && authors.length ? (
          <Field label="Author" required>
            {(p) => (
              <Select {...p} value={choice} onChange={(e) => setChoice(e.target.value)} autoFocus>
                <option value="">Select an Author…</option>
                {authors.map((a) => <option key={a.id} value={a.id}>{a.fullName} ({a.username}){a.status === 'pending' ? ' · setup pending' : ''}</option>)}
              </Select>
            )}
          </Field>
        ) : null}
      </form>
    </Dialog>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useResource(`/api/projects/${encodeURIComponent(id)}`);
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [params, setParams] = useSearchParams();
  const tab = ['dms', 'graphics', 'publication'].includes(params.get('tab')) ? params.get('tab') : 'overview';

  const back = (
    <Link to="/projects" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink mb-4">
      <Icon name="arrowLeft" size={15} />Projects
    </Link>
  );
  if (error) {
    return <>{back}<Card>{error.status === 404 ? <EmptyState icon="folder" title="Project not found">It does not exist, or you are not a member of it.</EmptyState> : <ErrorState error={error} onRetry={reload} />}</Card></>;
  }
  if (loading) return <>{back}<Card className="p-6"><LoadingBlock rows={6} /></Card></>;

  const p = data.project;
  const asAdmin = data.relation === 'oversight';
  // The administrator's assign check needs a reason, so it reads "not allowed" here; they assign as an override.
  const canAssign = data.permissions.assign || asAdmin;

  return (
    <>
      {back}
      <PageHeader eyebrow="Project" title={p.name} subtitle={p.description || null}
        actions={canAssign && tab === 'overview' ? <Button variant="primary" icon="plus" onClick={() => setAssigning(true)}>Assign Author</Button> : null} />

      <Tabs idBase="project" value={tab} onChange={(v) => setParams(v === 'overview' ? {} : { tab: v })}
        tabs={[{ value: 'overview', label: 'Overview' }, { value: 'dms', label: 'Data modules' }, { value: 'graphics', label: 'Graphics' }, { value: 'publication', label: 'Publication & PDF' }]} />

      <TabPanel idBase="project" value="dms" active={tab}><DataModulesTab project={p} canWrite={data.permissions.write} override={data.permissions.override} /></TabPanel>
      <TabPanel idBase="project" value="graphics" active={tab}><GraphicsTab project={p} canWrite={data.permissions.write} override={data.permissions.override} /></TabPanel>
      <TabPanel idBase="project" value="publication" active={tab}><PublicationTab project={p} canWrite={data.permissions.write} canBuild={data.permissions.build} override={data.permissions.override} drafts={data.permissions.drafts} /></TabPanel>

      <TabPanel idBase="project" value="overview" active={tab}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Assigned Authors" subtitle={`${data.authors.length} assigned in addition to the owner`} />
            <DataTable
              caption="Assigned Authors"
              rows={data.authors}
              initialSort={{ key: 'name', dir: 'asc' }}
              empty={<EmptyState icon="users" title="No Authors assigned" action={canAssign ? <Button icon="plus" onClick={() => setAssigning(true)}>Assign an Author</Button> : null} />}
              columns={[
                { key: 'name', header: 'Author', sortValue: (a) => a.fullName, render: (a) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={a.fullName} size={28} />
                    <div className="min-w-0">
                      <span className="font-medium text-ink">{a.fullName}</span>
                      <p className="font-mono text-[12px] text-ink-3">{a.username}</p>
                    </div>
                  </div>
                ) },
                { key: 'status', header: 'Status', sortValue: (a) => a.status, render: (a) => <StatusBadge status={a.status} />, hideBelow: 'sm' },
                { key: 'added', header: 'Assigned', sortValue: (a) => a.addedAt, render: (a) => <span className="text-ink-2">{fmtDate(a.addedAt)}</span>, hideBelow: 'md' },
                { key: 'work', header: 'Last activity', sortValue: (a) => (a.lastActivity ? a.lastActivity.at : ''), render: (a) => (a.lastActivity
                  ? <span className="text-[12.5px] text-ink-2">{describeAction(a.lastActivity.action, {})}<span className="block text-[12px] text-ink-3">{fmtRelative(a.lastActivity.at)}</span></span>
                  : <span className="text-[12px] text-ink-3">None yet</span>), hideBelow: 'lg' },
                ...(canAssign ? [{ key: 'remove', header: <span className="sr-only">Actions</span>, align: 'right', render: (a) => (
                  <Button size="sm" variant="danger-ghost" onClick={() => setRemoving(a)} aria-label={`Remove ${a.fullName} from ${p.name}`}>Remove</Button>
                ) }] : []),
              ]}
            />
          </Card>
          {!data.permissions.write ? (
            <Alert tone="info">{asAdmin
              ? 'You are viewing this project as the administrator. To change content, open a data module, the module list, the graphics or the publication and choose Edit as administrator: each editing session needs a written reason, and every save is recorded and told to the people involved.'
              : "You can read this project's content; the Authors who own or are assigned to it edit it."}</Alert>
          ) : null}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <div className="px-5 pb-3">
              <DetailList items={[
                ['Project id', <Mono key="i">{p.id}</Mono>],
                ['Owner', <OwnerTag key="o" owner={p.owner} size={20} />],
                ['Your access', <span key="r">{data.relation === 'owner' ? <Badge tone="accent" icon="key">Owner</Badge> : data.relation === 'assigned' ? <Badge icon="users">Assigned</Badge> : <Badge icon="shield">Administrator oversight</Badge>}</span>],
                ['Created', fmtDate(p.createdAt)],
                ['Status', <span key="s" className="capitalize">{p.status}</span>],
                ['Workspace', <span key="w" className="text-ink-2">csdb/, Media/, publication.xml, project.json</span>],
              ]} />
            </div>
          </Card>
        </div>
      </div>
      </TabPanel>

      <AssignDialog open={assigning} onClose={() => setAssigning(false)} projectId={p.id} asAdmin={asAdmin}
        onAssigned={(authors, who) => { setAssigning(false); setData({ ...data, authors }); toast.success('Author assigned', who ? who.fullName : undefined); }} />
      {asAdmin ? (
        <OverrideDialog open={!!removing} onClose={() => setRemoving(null)} title="Remove Author from project (override)" confirmLabel="Remove" tone="danger"
          people="the Author and the project's owner"
          description={removing ? `${removing.fullName} will lose access to ${p.name}. Their account is not affected.` : ''}
          onSubmit={async (reason) => {
            const r = await del(`/api/projects/${p.id}/members/${removing.id}`, { reason });
            setData({ ...data, authors: r.authors });
            toast.success('Author removed', removing.fullName);
            setRemoving(null);
          }} />
      ) : (
        <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title="Remove Author from project?" confirmLabel="Remove" tone="danger"
          onConfirm={async () => {
            const r = await del(`/api/projects/${p.id}/members/${removing.id}`);
            setData({ ...data, authors: r.authors });
            toast.success('Author removed', removing.fullName);
            setRemoving(null);
          }}>
          {removing ? <p><strong className="text-ink">{removing.fullName}</strong> will lose access to {p.name}. Their account is not affected.</p> : null}
        </ConfirmDialog>
      )}
    </>
  );
}
