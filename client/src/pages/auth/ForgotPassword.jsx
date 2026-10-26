import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from './AuthLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import { Field, Input } from '../../components/ui/Field.jsx';
import { Alert } from '../../components/ui/States.jsx';
import Icon from '../../components/Icon.jsx';
import { post } from '../../api.js';

export default function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!username.trim()) { setError('Enter your username.'); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await post('/api/auth/forgot', { username: username.trim() });
      setDone(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Your request goes to the person who manages your account. They will give you a temporary password.">
      {done ? (
        <div className="space-y-5">
          <Alert tone="ok" title="Request received">{done}</Alert>
          <ol className="text-[13px] text-ink-2 space-y-2">
            <li className="flex gap-2"><span className="font-mono text-ink-3">01</span>Your Project Manager (or the Software Administrator) reviews the request.</li>
            <li className="flex gap-2"><span className="font-mono text-ink-3">02</span>They give you a temporary password, valid for 24 hours and one sign-in.</li>
            <li className="flex gap-2"><span className="font-mono text-ink-3">03</span>Sign in with it and choose a new password straight away.</li>
          </ol>
          <Link to="/signin" className="inline-flex items-center gap-1.5 text-accent font-medium hover:underline"><Icon name="arrowLeft" size={16} />Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error ? <Alert>{error}</Alert> : null}
          <Field label="Username">
            {(p) => <Input {...p} autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />}
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={busy}>Request a reset</Button>
          <p className="text-center text-[13px]"><Link to="/signin" className="text-accent hover:underline">Back to sign in</Link></p>
        </form>
      )}
    </AuthLayout>
  );
}
