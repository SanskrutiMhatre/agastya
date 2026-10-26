import { useEffect, useState } from 'react';
import { Dialog } from './ui/Dialog.jsx';
import Button from './ui/Button.jsx';
import { Field, PasswordInput, PasswordChecklist } from './ui/Field.jsx';
import { Alert } from './ui/States.jsx';
import { useToast } from './ui/Toast.jsx';
import { useAuth } from '../auth.jsx';
import { post } from '../api.js';

// Voluntary password change from the account menu.
export default function ChangePasswordDialog({ open, onClose }) {
  const { me, refresh } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (open) { setCurrent(''); setNext(''); setConfirm(''); setError(null); } }, [open]);

  async function submit(e) {
    e.preventDefault();
    if (next !== confirm) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    setError(null);
    try {
      await post('/api/auth/change-password', { currentPassword: current, newPassword: next });
      await refresh();
      toast.success('Password changed', 'Other sessions for your account were signed out.');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Change password" description="Choose a password you do not use anywhere else."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" type="submit" form="change-pw" loading={busy}>Change password</Button>
        </>
      )}>
      <form id="change-pw" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Current password" required>
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />}
        </Field>
        <Field label="New password" required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
        </Field>
        <Field label="Confirm new password" required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <PasswordChecklist password={next} confirm={confirm} username={me && me.user.username} />
      </form>
    </Dialog>
  );
}
