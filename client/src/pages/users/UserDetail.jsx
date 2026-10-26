import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardHeader, DetailList } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Avatar, Badge, Mono, RoleBadge, StatusBadge } from '../../components/ui/Badge.jsx';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog.jsx';
import { Field, Input } from '../../components/ui/Field.jsx';
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import SecretReveal from '../../components/ui/SecretReveal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import Icon from '../../components/Icon.jsx';
import useResource from '../../lib/useResource.js';
import { patch, post } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { ROLE_LABELS } from '../../nav.js';
import { fmtDate, fmtDateTime, fmtRelative } from '../../lib/format.js';

function tempState(t) {
  if (!t) return <span className="text-ink-3">None outstanding</span>;
  if (t.used) return <Badge tone="neutral" icon="check">Used, awaiting new password</Badge>;
  if (t.expired) return <Badge tone="danger" icon="clock">Expired {fmtRelative(t.expiresAt)}</Badge>;
  return <Badge tone="warn" icon="clock">Unused, expires {fmtDateTime(t.expiresAt)}</Badge>;
}

function RenameDialog({ open, onClose, user, onDone }) {
  const [name, setName] = useState(user.fullName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { await onDone(name.trim()); } catch (err) { setError(err.message); setBusy(false); }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Edit name" size="sm"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" type="submit" form="rename" loading={busy}>Save</Button></>}>
      <form id="rename" onSubmit={submit} className="space-y-3" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Full name" required>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />}</Field>
      </form>
    </Dialog>
  );
}

export default function UserDetail() {
  const { id } = useParams();
  const { me, refresh } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useResource(`/api/users/${encodeURIComponent(id)}`);
  const [confirm, setConfirm] = useState(null);
  const [secret, setSecret] = useState(null);
  const [renaming, setRenaming] = useState(false);

  const back = (
    <Link to="/users" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink mb-4">
      <Icon name="arrowLeft" size={15} />{me.user.role === 'software_admin' ? 'Users' : 'Authors'}
    </Link>
  );
  if (error) {
    return <>{back}<Card>{error.status === 404 ? <EmptyState icon="users" title="Account not found">It does not exist, or it is outside the accounts you manage.</EmptyState> : <ErrorState error={error} onRetry={reload} />}</Card></>;
  }
  if (loading) return <>{back}<Card className="p-6"><LoadingBlock rows={6} /></Card></>;

  const u = data.user;
  const can = data.permissions;
  const otherRole = u.role === 'project_manager' ? 'author' : 'project_manager';

  const ACTIONS = {
    reset: {
      title: u.tempPassword ? 'Issue a new temporary password?' : 'Reset password?', label: 'Issue temporary password', tone: 'primary',
      body: <><p>{u.fullName} will get a new temporary password (valid 24 hours, one sign-in) and every current session will be signed out.</p><p className="text-[13px]">Any earlier temporary password stops working.</p></>,
      run: async () => {
        const r = await post(`/api/users/${u.id}/reset`);
        setSecret({ title: 'Temporary password issued', username: u.username, tempPassword: r.tempPassword, expiresAt: r.tempPasswordExpiresAt });
      },
    },
    disable: {
      title: `Disable ${u.fullName}?`, label: 'Disable account', tone: 'danger',
      body: <p>They are signed out at once and cannot sign in until the account is enabled again. Their work and project assignments are kept. The owners of other projects they work on are told.</p>,
      run: async () => { await post(`/api/users/${u.id}/disable`); toast.success('Account disabled', `${u.fullName} has been signed out.`); },
    },
    enable: {
      title: `Enable ${u.fullName}?`, label: 'Enable account', tone: 'primary',
      body: <p>They can sign in again with their existing password.</p>,
      run: async () => { await post(`/api/users/${u.id}/enable`); toast.success('Account enabled'); },
    },
    role: {
      title: `Change role to ${ROLE_LABELS[otherRole]}?`, label: 'Change role', tone: 'primary',
      body: <p>{u.fullName} will become a {ROLE_LABELS[otherRole]}. The change is audited and they are notified.</p>,
      run: async () => { await patch(`/api/users/${u.id}`, { role: otherRole }); toast.success('Role changed', `${u.fullName} is now a ${ROLE_LABELS[otherRole]}.`); },
    },
    signout: {
      title: `Sign ${u.fullName} out everywhere?`, label: 'Sign out', tone: 'danger',
      body: <p>Every active session for this account ends now. They can sign in again.</p>,
      run: async () => { const r = await post(`/api/users/${u.id}/sessions/revoke`); toast.success('Signed out', `${r.revoked} session(s) ended.`); },
    },
  };
  const act = confirm && (confirm.session ? {
    title: 'End this session?', label: 'End session', tone: 'danger',
    body: <p>The session from <Mono>{confirm.session.ip || 'unknown address'}</Mono> ends immediately.</p>,
    run: async () => { await post(`/api/sessions/${confirm.session.id}/revoke`); toast.success('Session ended'); },
  } : ACTIONS[confirm.kind]);

  return (
    <>
      {back}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex flex-wrap items-center gap-4 px-6 py-5">
              <Avatar name={u.fullName} size={56} />
              <div className="min-w-0 flex-1">
                <h1 className="text-[20px] font-semibold text-ink">{u.fullName}</h1>
                <p className="font-mono text-[13px] text-ink-3">{u.username}</p>
                <div className="mt-2 flex flex-wrap gap-2"><RoleBadge role={u.role} /><StatusBadge status={u.status} /></div>
              </div>
              {can.editName ? <Button size="sm" icon="edit" onClick={() => setRenaming(true)}>Edit name</Button> : null}
            </div>
            <div className="px-6 pb-4 border-t border-line">
              <DetailList items={[
                ['Created by', u.createdBy ? <Link to={`/users/${u.createdBy.id}`} className="text-accent hover:underline">{u.createdBy.fullName || u.createdBy.username}</Link> : 'Bootstrap (environment)'],
                ['Created', fmtDateTime(u.createdAt)],
                ['Last sign-in', u.lastLoginAt ? `${fmtDateTime(u.lastLoginAt)} (${fmtRelative(u.lastLoginAt)})` : 'Never'],
                ['Temporary password', tempState(u.tempPassword)],
                ...(u.disabledAt ? [['Disabled', fmtDateTime(u.disabledAt)]] : []),
                ...(u.role !== 'author' ? [['Accounts created', data.createdAccounts]] : []),
              ]} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Projects" subtitle="Owned and assigned" />
            {data.projects.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {data.projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link to={`/projects/${p.id}`} className="font-medium text-ink hover:text-accent hover:underline">{p.name}</Link>
                    <span className="text-[12px] text-ink-3">{p.relation === 'owner' ? 'Owner since' : 'Assigned'} {fmtDate(p.since)}</span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="folder" title="No projects" />}
          </Card>

          {data.sessions ? (
            <Card>
              <CardHeader title="Active sessions" subtitle="One active session per account; a new sign-in replaces the old one."
                actions={data.sessions.length ? <Button size="sm" variant="danger-ghost" icon="logout" onClick={() => setConfirm({ kind: 'signout' })}>Sign out everywhere</Button> : null} />
              {data.sessions.length ? (
                <ul className="divide-y divide-line border-t border-line">
                  {data.sessions.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
                      <Icon name="monitor" size={18} className="text-ink-3" />
                      <div className="min-w-0 flex-1">
                        <p className="text-ink truncate">{s.userAgent || 'Unknown client'}</p>
                        <p className="text-ink-3"><Mono>{s.ip || '—'}</Mono> · started {fmtRelative(s.createdAt)} · last seen {fmtRelative(s.lastSeenAt)} · expires {fmtDate(s.expiresAt)}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ session: s })}>End</Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="px-5 pb-5 text-ink-3">No active sessions.</p>}
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Account actions" />
            <div className="px-5 pb-5 space-y-2">
              {can.reset ? <Button className="w-full" icon="key" onClick={() => setConfirm({ kind: 'reset' })}>{u.tempPassword ? 'Reissue temporary password' : 'Reset password'}</Button> : null}
              {can.changeRole ? <Button className="w-full" icon="users" onClick={() => setConfirm({ kind: 'role' })}>Make {ROLE_LABELS[otherRole]}</Button> : null}
              {can.disable ? (u.status === 'disabled'
                ? <Button className="w-full" icon="power" onClick={() => setConfirm({ kind: 'enable' })}>Enable account</Button>
                : <Button className="w-full" variant="danger-ghost" icon="ban" onClick={() => setConfirm({ kind: 'disable' })}>Disable account</Button>) : null}
              {!can.reset && !can.changeRole && !can.disable ? <p className="text-[13px] text-ink-3">No actions are available to you for this account.</p> : null}
              {u.status === 'disabled' && !can.reset ? <p className="text-[12px] text-ink-3">Enable the account before resetting its password.</p> : null}
            </div>
          </Card>
          <Alert tone="info" title="Temporary passwords">
            Format <span className="font-mono">username@year</span>. Valid for 24 hours and one sign-in; a new password must be chosen immediately. Shown once.
          </Alert>
        </div>
      </div>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title={act ? act.title : ''} confirmLabel={act ? act.label : ''} tone={act ? act.tone : 'primary'}
        onConfirm={async () => { await act.run(); setConfirm(null); await reload(); refresh(); }}>
        {act ? act.body : null}
      </ConfirmDialog>
      <SecretReveal secret={secret} onClose={() => setSecret(null)} />
      {renaming ? (
        <RenameDialog open={renaming} onClose={() => setRenaming(false)} user={u}
          onDone={async (fullName) => { await patch(`/api/users/${u.id}`, { fullName }); setRenaming(false); toast.success('Name updated'); reload(); }} />
      ) : null}
    </>
  );
}
