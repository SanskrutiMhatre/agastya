import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { Badge, Mono, RoleBadge } from '../../components/ui/Badge.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import useResource from '../../lib/useResource.js';
import { post } from '../../api.js';
import { fmtDate, fmtRelative } from '../../lib/format.js';

// Every live session in Agastya (decisions.md V1): who, from where, since when; any but your own can be ended.
export default function SessionsTab() {
  const toast = useToast();
  const { data, loading, error, reload } = useResource('/api/admin/sessions');
  const [ending, setEnding] = useState(null);
  if (error) return <Card><ErrorState error={error} onRetry={reload} /></Card>;
  return (
    <Card>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line text-[13px] text-ink-3">
        <p className="flex-1">{data ? `${data.sessions.length} active session${data.sessions.length === 1 ? '' : 's'}. One per account; a new sign-in replaces the old one.` : ''}</p>
        <Button size="sm" variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>
      </div>
      {loading ? <div className="p-4"><LoadingBlock rows={4} /></div> : (
        <DataTable
          caption="Active sessions"
          rows={data.sessions}
          initialSort={{ key: 'seen', dir: 'desc' }}
          empty={<EmptyState icon="lock" title="No active sessions" />}
          columns={[
            { key: 'user', header: 'Account', sortValue: (s) => s.user.fullName, render: (s) => (
              <div><Link to={`/users/${s.user.id}`} className="font-medium text-ink hover:text-accent hover:underline">{s.user.fullName}</Link><Mono className="block text-[12px]">{s.user.username}</Mono></div>
            ) },
            { key: 'role', header: 'Role', sortValue: (s) => s.user.role, render: (s) => <RoleBadge role={s.user.role} />, hideBelow: 'md' },
            { key: 'from', header: 'From', sortValue: (s) => s.ip || '', render: (s) => <div className="min-w-0"><Mono className="text-[12px]">{s.ip || '—'}</Mono><span className="block max-w-[260px] truncate text-[12px] text-ink-3" title={s.userAgent || ''}>{s.userAgent || 'Unknown client'}</span></div>, hideBelow: 'sm' },
            { key: 'seen', header: 'Last seen', sortValue: (s) => s.lastSeenAt || '', render: (s) => <span className="text-ink-2">{fmtRelative(s.lastSeenAt)}<span className="block text-[12px] text-ink-3">since {fmtRelative(s.createdAt)}</span></span> },
            { key: 'expires', header: 'Expires', sortValue: (s) => s.expiresAt, render: (s) => <span className="text-ink-2">{fmtDate(s.expiresAt)}</span>, hideBelow: 'lg' },
            { key: 'act', header: <span className="sr-only">Actions</span>, align: 'right', render: (s) => (s.current
              ? <Badge tone="accent">This session</Badge>
              : <Button size="sm" variant="danger-ghost" onClick={() => setEnding(s)} aria-label={`End the session of ${s.user.username}`}>End</Button>) },
          ]}
        />
      )}
      <ConfirmDialog open={!!ending} onClose={() => setEnding(null)} title="End this session?" confirmLabel="End session" tone="danger"
        onConfirm={async () => { await post(`/api/sessions/${ending.id}/revoke`); toast.success('Session ended', ending.user.fullName); setEnding(null); reload(); }}>
        {ending ? <p>{ending.user.fullName} is signed out at once. They can sign in again.</p> : null}
      </ConfirmDialog>
    </Card>
  );
}
