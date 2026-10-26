import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import { Field, Input, PasswordInput, PasswordChecklist } from '../../components/ui/Field.jsx';
import { Alert } from '../../components/ui/States.jsx';
import { useAuth } from '../../auth.jsx';
import { post } from '../../api.js';
import { ROLE_LABELS } from '../../nav.js';

function SignOutLink() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  return (
    <button type="button" onClick={async () => { await signOut(); nav('/signin', { replace: true }); }} className="text-[13px] text-ink-3 hover:text-ink hover:underline">
      Sign out instead
    </button>
  );
}

// First sign-in for an account someone else created.
export function Onboarding() {
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const [fullName, setFullName] = useState(me.user.fullName);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (pw !== confirm) { setError('The passwords do not match.'); return; }
    setBusy(true);
    setError(null);
    try {
      await post('/api/auth/onboarding', { fullName, newPassword: pw });
      await refresh();
      nav('/', { replace: true });
    } catch (err) {
      setError(err.code === 'UNAUTHENTICATED' ? 'This setup session has expired. Sign in again with your temporary password, or ask for a new one.' : err.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout step="First sign-in · Step 1 of 1" title="Set up your account"
      subtitle={`You were added as ${ROLE_LABELS[me.user.role]}. Confirm your name and choose a password to replace the temporary one.`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <div className="rounded-md border border-line bg-surface-2 px-3 py-2.5 text-[13px]">
          <span className="text-ink-3">Username</span> <span className="font-mono text-ink ml-2">{me.user.username}</span>
        </div>
        <Field label="Full name" required>
          {(p) => <Input {...p} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />}
        </Field>
        <Field label="New password" required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />}
        </Field>
        <Field label="Confirm password" required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <PasswordChecklist password={pw} confirm={confirm} username={me.user.username} />
        <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={busy}>Finish setup</Button>
        <p className="text-center"><SignOutLink /></p>
      </form>
    </AuthLayout>
  );
}

// Forced change after a reset (or for the bootstrap administrator).
export function ForcedPasswordChange() {
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (pw !== confirm) { setError('The passwords do not match.'); return; }
    setBusy(true);
    setError(null);
    try {
      await post('/api/auth/change-password', { newPassword: pw });
      await refresh();
      nav('/', { replace: true });
    } catch (err) {
      setError(err.code === 'UNAUTHENTICATED' ? 'This session has expired. Sign in again with your temporary password, or ask for a new one.' : err.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout step="Password change required" title="Choose a new password"
      subtitle="You signed in with a temporary password. Set a new one to continue; nothing else is available until you do.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <div className="rounded-md border border-line bg-surface-2 px-3 py-2.5 text-[13px]">
          <span className="text-ink-3">Signed in as</span> <span className="font-mono text-ink ml-2">{me.user.username}</span>
        </div>
        <Field label="New password" required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />}
        </Field>
        <Field label="Confirm password" required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <PasswordChecklist password={pw} confirm={confirm} username={me.user.username} />
        <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={busy}>Set password and continue</Button>
        <p className="text-center"><SignOutLink /></p>
      </form>
    </AuthLayout>
  );
}
