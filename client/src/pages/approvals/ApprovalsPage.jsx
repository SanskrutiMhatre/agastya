import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { Select } from '../../components/ui/Field.jsx';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import useResource from '../../lib/useResource.js';
import { useAuth } from '../../auth.jsx';
import { fmtRelative } from '../../lib/format.js';
import { RequestBadge } from '../projects/ApprovalCard.jsx';

/*
  The approvals queue (decisions.md M1): a Project Manager's requests,
  pending first; the administrator sees every request (oversight, Phase 4
  brings their override).
*/
export default function ApprovalsPage() {
  const { me } = useAuth();
  const { data, loading, error, reload } = useResource('/api/requests/queue');
  const [filter, setFilter] = useState('open');
  const isAdmin = me.user.role === 'software_admin';
  const rows = data ? data.requests.filter((r) => (filter === 'open' ? r.status === 'pending' : filter === 'decided' ? r.status !== 'pending' : true)) : [];

  return (
    <>
      <PageHeader eyebrow={isAdmin ? 'Oversight' : 'Review'} title="Approvals"
        subtitle={isAdmin ? 'Every publication request. Decisions by the administrator are an override with a written reason (Phase 4).' : 'Publications Authors have sent to you. Open one to review its frozen snapshot and decide.'} />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line">
          <div className="w-48">
            <Select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="open">Pending ({data ? data.pending : 0})</option>
              <option value="decided">Decided and closed</option>
              <option value="all">All</option>
            </Select>
          </div>
        </div>
        {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <div className="p-5"><LoadingBlock rows={4} /></div> : (
          <DataTable
            caption="Approval requests"
            rows={rows}
            initialSort={null}
            empty={<EmptyState icon="check" title={filter === 'open' ? 'Nothing waiting for you' : 'No requests'}>{filter === 'open' ? 'Requests Authors send you appear here.' : ''}</EmptyState>}
            columns={[
              { key: 'project', header: 'Publication', sortValue: (r) => r.projectName, render: (r) => (
                <Link to={`/approvals/${r.id}`} className="font-medium text-ink hover:text-accent hover:underline">{r.title || r.projectName}<span className="block text-[12px] font-normal text-ink-3">{r.projectName}</span></Link>
              ) },
              { key: 'author', header: 'Submitted by', sortValue: (r) => r.submittedBy.name, render: (r) => <span className="text-ink-2">{r.submittedBy.name}</span> },
              ...(isAdmin ? [{ key: 'manager', header: 'Sent to', sortValue: (r) => r.manager.name, render: (r) => <span className="text-ink-2">{r.manager.name}</span> }] : []),
              { key: 'submitted', header: 'Submitted', sortValue: (r) => r.submittedAt, render: (r) => <span className="text-ink-2">{fmtRelative(r.submittedAt)}</span>, hideBelow: 'md' },
              { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => <span className="inline-flex flex-wrap items-center gap-1.5"><RequestBadge status={r.status} />{r.previousRequestId && r.status === 'pending' ? <span className="text-[11.5px] text-ink-3">resubmission</span> : null}</span> },
            ]}
          />
        )}
      </Card>
    </>
  );
}
