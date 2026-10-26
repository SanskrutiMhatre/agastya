import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog.jsx';
import Button from '../../components/ui/Button.jsx';
import { Field, Input, Select } from '../../components/ui/Field.jsx';
import { Alert } from '../../components/ui/States.jsx';
import { post } from '../../api.js';

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/*
  Create an account within the caller's hierarchy. The administrator chooses
  Project Manager or Author; a Project Manager can only create Authors, so
  the role is fixed. On success the caller receives the one-time temporary
  password through onCreated.
*/
export default function CreateUserDialog({ open, onClose, onCreated, isAdmin }) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('author');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => { if (open) { setUsername(''); setFullName(''); setRole('author'); setError(null); setTouched(false); } }, [open]);

  const uname = username.trim().toLowerCase();
  const unameError = touched && uname && !USERNAME_RE.test(uname)
    ? '3 to 32 characters: lowercase letters, digits, dot, dash or underscore.' : null;

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (!USERNAME_RE.test(uname) || !fullName.trim()) { setError('Enter a valid username and the person’s full name.'); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await post('/api/users', { username: uname, fullName: fullName.trim(), role: isAdmin ? role : 'author' });
      onCreated(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isAdmin ? 'Create user' : 'Create Author'}
      description="The account starts with a temporary password that you hand over. The person sets their own password at first sign-in."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" type="submit" form="create-user" loading={busy}>Create account</Button>
        </>
      )}>
      <form id="create-user" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Full name" required>
          {(p) => <Input {...p} autoComplete="off" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} autoFocus />}
        </Field>
        <Field label="Username" required error={unameError} hint="Lowercase, 3 to 32 characters. It cannot be changed later.">
          {(p) => (
            <Input {...p} className="font-mono" autoComplete="off" autoCapitalize="none" spellCheck={false}
              value={username} onChange={(e) => setUsername(e.target.value)} onBlur={() => setTouched(true)} maxLength={32} />
          )}
        </Field>
        {isAdmin ? (
          <Field label="Role" required hint={role === 'project_manager' ? 'Creates projects, assigns Authors, approves publications.' : 'Creates own projects; writes data modules and publications in owned or assigned projects.'}>
            {(p) => (
              <Select {...p} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="author">Author</option>
                <option value="project_manager">Project Manager</option>
              </Select>
            )}
          </Field>
        ) : (
          <div className="rounded-md border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">
            Role: <span className="font-medium text-ink">Author</span>. Project Managers create Author accounts only.
          </div>
        )}
      </form>
    </Dialog>
  );
}
