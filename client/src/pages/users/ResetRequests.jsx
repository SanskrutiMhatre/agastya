import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { Avatar, Badge, RoleBadge } from '../../components/ui/Badge.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import SecretReveal from '../../components/ui/SecretReveal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { post } from '../../api.js';
import { fmtRelative } from '../../lib/format.js';

export default function ResetRequests({ resource, isAdmin, onChanged }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(null); // { kind, request }
  const [secret, setSecret] = useState(null);
  const { data, loading, error, reload } = resource;

  async function decide() {
    const { kind, request } = confirm;
    const r = await post(`/api/resets/${request.id}/${kind}`);
    setConfirm(null);
    if (kind === 'approve') {
      setSecret({ title: 'Reset approved', username: r.username, tempPassword: r.tempPassword, expiresAt: r.tempPasswordExpiresAt });
    } else {
      toast.success('Request declined', `${request.user.fullName} has been notified.`);
    }
    await reload();
    onChanged();
  }

  return (
    <Card>
      {error ? <ErrorState error={error} onRetry={reload} />
        : loading ? <div className="p-5"><LoadingBlock rows={3} /></div>
          : (
            <DataTable
              caption="Pending password reset requests"
              rows={data.requests}
              initialSort={{ key: 'requested', dir: 'asc' }}
              empty={<EmptyState icon="key" title="No pending requests">Forgot-password requests from accounts you manage appear here.</EmptyState>}
              columns={[
                {
                  key: 'user', header: 'Account', sortValue: (r) => r.user.fullName,
                  render: (r) => (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.user.fullName} size={28} />
                      <div className="min-w-0">
                        <Link to={`/users/${r.user.id}`} className="font-medium text-ink hover:text-accent hover:underline">{r.user.fullName}</Link>
                        <p className="font-mono text-[12px] text-ink-3">{r.user.username}</p>
                      </div>
                    </div>
                  ),
                },
                { key: 'role', header: 'Role', render: (r) => <RoleBadge role={r.user.role} />, hideBelow: 'md' },
                ...(isAdmin ? [{
                  key: 'approver', header: 'Approver', sortValue: (r) => (r.approver ? r.approver.fullName : ''), hideBelow: 'lg',
                  render: (r) => (r.assignedToMe ? <Badge tone="accent">You</Badge> : <span className="text-ink-2">{r.approver ? r.approver.fullName : '—'}</span>),
                }] : []),
                { key: 'requested', header: 'Requested', sortValue: (r) => r.requestedAt, render: (r) => <span className="text-ink-2">{fmtRelative(r.requestedAt)}</span> },
                {
                  key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
                  render: (r) => (
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'reject', request: r })} aria-label={`Decline reset for ${r.user.username}`}>Decline</Button>
                      <Button size="sm" variant="primary" onClick={() => setConfirm({ kind: 'approve', request: r })} aria-label={`Approve reset for ${r.user.username}`}>Approve</Button>
                    </div>
                  ),
                },
              ]}
            />
          )}

      <ConfirmDialog
        open={!!confirm} onClose={() => setConfirm(null)} onConfirm={decide}
        title={confirm && confirm.kind === 'approve' ? 'Approve password reset?' : 'Decline password reset?'}
        confirmLabel={confirm && confirm.kind === 'approve' ? 'Approve and issue password' : 'Decline request'}
        tone={confirm && confirm.kind === 'approve' ? 'primary' : 'danger'}
      >
        {confirm ? (confirm.kind === 'approve' ? (
          <>
            <p>A temporary password will be issued to <strong className="text-ink">{confirm.request.user.fullName}</strong> and all of their sessions will be signed out.</p>
            {isAdmin && !confirm.request.assignedToMe ? <p className="text-[13px]">This request is assigned to {confirm.request.approver ? confirm.request.approver.fullName : 'another approver'}; your decision is recorded as an administrator decision.</p> : null}
            <p className="text-[13px]">Confirm the request is genuine (for example, by phone) before approving.</p>
          </>
        ) : <p>{confirm.request.user.fullName} will be told their request was declined. Their password does not change.</p>) : null}
      </ConfirmDialog>
      <SecretReveal secret={secret} onClose={() => setSecret(null)} />
    </Card>
  );
}
