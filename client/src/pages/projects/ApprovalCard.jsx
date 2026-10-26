import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Dialog, ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Field, Select, Textarea } from '../../components/ui/Field.jsx';
import { Alert, LoadingBlock } from '../../components/ui/States.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import Icon from '../../components/Icon.jsx';
import BuildLog from '../../components/BuildLog.jsx';
import { get, post } from '../../api.js';
import { fmtDateTime, fmtRelative } from '../../lib/format.js';
import { useAuth } from '../../auth.jsx';

export const REQUEST_STATUS = {
  pending: { label: 'Pending approval', tone: 'warn', icon: 'clock' },
  approved: { label: 'Approved', tone: 'ok', icon: 'checkCircle' },
  rejected: { label: 'Rejected', tone: 'danger', icon: 'ban' },
  changes_requested: { label: 'Changes requested', tone: 'warn', icon: 'edit' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral', icon: 'undo' },
  stale: { label: 'Out of date', tone: 'danger', icon: 'alert' },
};

export function RequestBadge({ status }) {
  const s = REQUEST_STATUS[status] || { label: status, tone: 'neutral' };
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
}

// The submission refusal's errors, grouped by data module, each module linked to its editor (decisions.md B6).
function ValidationErrors({ project, errors }) {
  const groups = new Map();
  for (const e of errors) {
    const key = e.module ? e.module.id : e.file || 'publication';
    if (!groups.has(key)) groups.set(key, { module: e.module, file: e.file, items: [] });
    groups.get(key).items.push(e);
  }
  return (
    <ul className="mt-2 space-y-2 max-h-64 overflow-y-auto text-ink" data-testid="submit-errors">
      {[...groups.values()].map((g) => (
        <li key={g.module ? g.module.id : g.file}>
          {g.module
            ? <Link to={`/projects/${project.id}/dms/${g.module.id}`} className="font-medium underline">{g.module.title} <span className="font-mono text-[11.5px]">DMC-{g.module.dmc}</span></Link>
            : <span className="font-medium">{g.file || 'Publication'}</span>}
          <ul className="mt-0.5 list-disc pl-5 text-[12.5px]">
            {g.items.map((e, i) => <li key={i}>{e.kind === 'brex' ? 'BREX' : e.kind === 'schema' ? 'XSD' : e.kind}{e.line > 1 ? `, line ${e.line}` : ''}: {e.message}</li>)}
          </ul>
        </li>
      ))}
    </ul>
  );
}

// A decision and its comment, as shown to the submitter and the project's Authors (decisions.md M6).
function Decision({ r }) {
  if (!r.decidedBy) return null;
  return (
    <div className="space-y-1" data-testid="request-decision">
      <p className="text-ink-2">{(REQUEST_STATUS[r.status] || {}).label} by <span className="font-medium text-ink">{r.decidedBy.name}</span>, {fmtDateTime(r.decidedAt)}</p>
      {r.decisionComment ? <blockquote className="border-l-2 border-line pl-3 text-ink whitespace-pre-wrap">{r.decisionComment}</blockquote> : null}
    </div>
  );
}

/*
  Submit for approval (PROMPT.md): the Author chooses the Project Manager
  (by default the one who created their account), the server validates,
  builds the PDF and freezes a snapshot; the request then shows here with
  its status. A pending request can be withdrawn; a change to the
  publication's sources after submission makes it stale.
*/
export default function ApprovalCard({ project, canSubmit, buildLog, onChanged, refreshKey }) {
  const toast = useToast();
  const { me } = useAuth();
  const [requests, setRequests] = useState(null);
  const [approvers, setApprovers] = useState(null);
  const [open, setOpen] = useState(false);
  const [approverId, setApproverId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [withdraw, setWithdraw] = useState(null);

  const load = useCallback(async () => {
    try { setRequests((await get(`/api/projects/${project.id}/requests`)).requests); } catch { setRequests([]); }
  }, [project.id]);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function openSubmit() {
    setError(null); setNote(''); setOpen(true);
    try {
      const a = await get(`/api/projects/${project.id}/approvers`);
      // A resubmission goes back to the manager who decided the last request, if still active (M5).
      const last = requests && requests[0];
      const again = last && ['rejected', 'changes_requested'].includes(last.status) && a.approvers.find((x) => x.id === (last.decidedBy ? last.decidedBy.id : last.manager.id));
      setApprovers(a.approvers); setApproverId(again ? again.id : a.defaultId || (a.approvers[0] ? a.approvers[0].id : ''));
    } catch (e) { setError(e); }
  }

  async function submit(e) {
    e.preventDefault();
    if (!approverId) { setError({ message: 'Choose the Project Manager to send it to.' }); return; }
    setBusy(true); setError(null);
    try {
      await post(`/api/projects/${project.id}/requests`, { approverId, note: note.trim() || undefined });
      toast.success('Submitted for approval', 'The publication was validated, built and frozen for review.');
      setOpen(false); await load(); onChanged && onChanged();
    } catch (err) { setError(err); }
    setBusy(false);
  }

  const current = requests && requests[0];
  const pending = requests && requests.find((r) => r.status === 'pending');

  return (
    <Card>
      <CardHeader title="Approval" subtitle="Submit the publication to a Project Manager for review"
        actions={canSubmit && !pending ? <Button size="sm" variant="primary" icon="send" onClick={openSubmit}>Submit for approval</Button> : null} />
      <div className="px-5 pb-5 space-y-3">
        {!requests ? <LoadingBlock rows={2} /> : !requests.length ? (
          <p className="text-[13px] text-ink-3">Not submitted yet.{canSubmit ? ' Validation must pass; the PDF is built and frozen with the sources when you submit.' : ''}</p>
        ) : (
          <>
            <div className="rounded-md border border-line p-3 text-[13px] space-y-1.5" data-testid="current-request">
              <div className="flex flex-wrap items-center gap-2"><RequestBadge status={current.status} /><span className="text-ink-3">submitted {fmtRelative(current.submittedAt)} by {current.submittedBy.name}</span></div>
              <p className="text-ink-2">To <span className="font-medium">{current.manager.name}</span>{current.note ? ` · “${current.note}”` : ''}</p>
              {current.status === 'pending' ? <p className="text-warn flex items-center gap-1.5"><Icon name="lock" size={14} />Its publication module and data modules are locked until the request is withdrawn or decided.</p> : null}
              {current.status === 'stale' ? <p className="text-danger">The publication changed after it was submitted ({current.staleReason || 'content changed'}). Submit it again.</p> : null}
              <Decision r={current} />
              {current.status === 'changes_requested' ? <p className="text-ink-2">Make the changes, then submit again; the comments stay in the history for the next review.</p> : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={current.snapshotPdf} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-accent hover:underline"><Icon name="book" size={14} />Submitted PDF</a>
                {current.status === 'pending' && current.submittedBy.id === me.user.id ? <Button size="sm" variant="ghost" icon="undo" onClick={() => setWithdraw(current)}>Withdraw</Button> : null}
              </div>
            </div>
            {requests.length > 1 ? (
              <details className="text-[12.5px]">
                <summary className="cursor-pointer text-ink-3">History: earlier requests ({requests.length - 1})</summary>
                <ul className="mt-2 divide-y divide-line rounded-md border border-line">
                  {requests.slice(1).map((r) => (
                    <li key={r.id} className="px-3 py-2 space-y-1">
                      <div className="flex flex-wrap items-center gap-2"><RequestBadge status={r.status} /><span className="text-ink-3">{fmtDateTime(r.submittedAt)} · {r.manager.name}</span></div>
                      <Decision r={r} />
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </div>

      <Dialog open={open} onClose={() => !busy && setOpen(false)} title="Submit for approval" size="md"
        description="The publication is validated, built and frozen. The Project Manager reviews that frozen copy; your later edits do not change it, but they make the request out of date."
        footer={<><Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button variant="primary" icon="send" type="submit" form="submit-request" loading={busy}>Submit</Button></>}>
        <form id="submit-request" onSubmit={submit} className="space-y-4">
          {error ? (
            <Alert title={error.code === 'VALIDATION_FAILED' ? 'Not submitted: validation failed' : 'Not submitted'}>
              {error.message}
              {error.code === 'VALIDATION_FAILED' && error.body && error.body.errors ? <ValidationErrors project={project} errors={error.body.errors} /> : null}
            </Alert>
          ) : null}
          <Field label="Send to" hint="Any active Project Manager. The default is the manager who created your account.">
            {(p) => (
              <Select {...p} value={approverId} onChange={(e) => setApproverId(e.target.value)} disabled={!approvers}>
                {!approvers ? <option>Loading…</option> : approvers.length ? approvers.map((a) => <option key={a.id} value={a.id}>{a.fullName} ({a.username})</option>) : <option value="">No active Project Manager</option>}
              </Select>
            )}
          </Field>
          <Field label="Note for the reviewer" hint="Optional.">
            {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} />}
          </Field>
          {busy && buildLog ? <BuildLog log={buildLog} title="Building the PDF to submit" /> : null}
        </form>
      </Dialog>

      <ConfirmDialog open={!!withdraw} onClose={() => setWithdraw(null)} title="Withdraw the request?" confirmLabel="Withdraw"
        onConfirm={async () => { await post(`/api/requests/${withdraw.id}/withdraw`, {}); setWithdraw(null); toast.success('Request withdrawn'); await load(); onChanged && onChanged(); }}>
        {withdraw ? `${withdraw.manager.name} will be told. You can submit again at any time.` : ''}
      </ConfirmDialog>
    </Card>
  );
}
