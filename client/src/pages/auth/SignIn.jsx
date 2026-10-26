import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import { Field, Input, PasswordInput } from '../../components/ui/Field.jsx';
import { Alert } from '../../components/ui/States.jsx';
import { gateTarget, useAuth } from '../../auth.jsx';

export default function SignIn() {
  const { status, me, signIn, expired } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (status === 'authed') return <Navigate to={gateTarget(me) || '/'} replace />;

  async function submit(e) {
    e.preventDefault();
    if (!username.trim() || !password) { setError({ message: 'Enter your username and password.' }); return; }
    setBusy(true);
    setError(null);
    try {
      const fresh = await signIn(username.trim(), password);
      const from = loc.state && loc.state.from;
      nav(gateTarget(fresh) || (from && from.startsWith('/') && !from.startsWith('//') ? from : '/'), { replace: true });
    } catch (err) {
      setError(err);
      setPassword('');
      setBusy(false);
    }
  }

  const tempIssue = error && (error.code === 'TEMP_PASSWORD_EXPIRED' || error.code === 'TEMP_PASSWORD_USED');
  return (
    <AuthLayout title="Sign in" subtitle="Use the account your administrator or Project Manager created for you.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {expired && !error ? <Alert tone="info">Your session ended. Sign in again to continue.</Alert> : null}
        {error ? (
          <Alert tone={tempIssue ? 'warn' : 'danger'} title={error.code === 'RATE_LIMITED' ? 'Too many attempts' : tempIssue ? 'Temporary password not accepted' : undefined}>
            {error.code === 'RATE_LIMITED' && error.body && error.body.retryAfterSeconds
              ? `Try again in about ${Math.ceil(error.body.retryAfterSeconds / 60)} minute(s).`
              : error.message}
          </Alert>
        ) : null}
        <Field label="Username">
          {(p) => <Input {...p} autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />}
        </Field>
        <Field label="Password">
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={busy}>Sign in</Button>
        <p className="text-center text-[13px]">
          <Link to="/forgot-password" className="text-accent hover:underline">Forgot your password?</Link>
        </p>
      </form>
      <p className="mt-10 text-[12px] text-ink-3 border-t border-line pt-4">
        There is no self-registration. If you need an account, ask your Project Manager or the Software Administrator.
      </p>
    </AuthLayout>
  );
}
