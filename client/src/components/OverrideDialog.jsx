import { useEffect, useState } from 'react';
import Button from './ui/Button.jsx';
import { Dialog } from './ui/Dialog.jsx';
import { Field, Textarea } from './ui/Field.jsx';
import { Alert } from './ui/States.jsx';
import Icon from './Icon.jsx';

export const REASON_MIN = 10;
export const REASON_MAX = 1000;

/*
  Every administrator override asks for a written reason here (decisions.md
  V2): decide, reset or reassign a request, assign or remove an Author, or
  start editing a project's document. The reason is recorded in the audit
  log and shown to the people involved, and the dialog says so and names
  them. `children` adds the override's own fields (a decision and its
  comment, a manager); `valid` says whether they are complete.
*/
export default function OverrideDialog({
  open, onClose, title, description, people, confirmLabel = 'Confirm override', tone = 'primary', onSubmit, children, valid = true, testId = 'override-dialog',
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setReason(''); setBusy(false); setError(null); } }, [open]);
  const length = reason.trim().length;
  const reasonOk = length >= REASON_MIN && length <= REASON_MAX;

  async function submit(e) {
    e.preventDefault();
    if (!reasonOk) { setError({ message: `Write a reason of ${REASON_MIN} to ${REASON_MAX} characters. It is required for every administrator override.` }); return; }
    if (!valid) { setError({ message: 'Complete the fields above first.' }); return; }
    setBusy(true); setError(null);
    try { await onSubmit(reason.trim()); } catch (err) { setError(err); setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} title={title} description={description} size="md"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="override-form" variant={tone === 'danger' ? 'danger' : 'primary'} icon="shield" loading={busy}>{confirmLabel}</Button></>}>
      <form id="override-form" onSubmit={submit} className="space-y-4" noValidate data-testid={testId}>
        {error ? <Alert title="Not done">{error.message}</Alert> : null}
        {children}
        <Field label="Reason for this override" required
          hint={`${length} of ${REASON_MAX} characters${length && length < REASON_MIN ? ` (at least ${REASON_MIN})` : ''}.`}>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={REASON_MAX + 50} rows={3} autoFocus={!children} />}
        </Field>
        <div className="flex gap-2 rounded-md border border-line bg-surface-2 px-3 py-2.5 text-[12.5px] text-ink-2" data-testid="override-notice">
          <Icon name="shield" size={16} className="mt-px text-ink-3 shrink-0" />
          <p>
            This is an <strong className="text-ink">administrator override</strong>. The reason is recorded in the audit log and is visible to the people involved
            {people ? <>: <span className="text-ink">{people}</span></> : ''}. They are notified.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
