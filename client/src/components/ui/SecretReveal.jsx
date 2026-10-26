import { useState } from 'react';
import { Dialog } from './Dialog.jsx';
import Button from './Button.jsx';
import Icon from '../Icon.jsx';
import { Alert } from './States.jsx';
import { fmtDateTime } from '../../lib/format.js';

/*
  The one and only display of a temporary password. It is held in component
  state while this dialog is open and discarded on close; it is never
  written to storage, the URL or the console.
*/
export default function SecretReveal({ secret, onClose }) {
  const [copied, setCopied] = useState(false);
  const open = !!secret;
  async function copy() {
    try {
      await navigator.clipboard.writeText(secret.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  }
  return (
    <Dialog
      open={open} onClose={onClose} dismissable={false} size="md"
      title={secret ? secret.title : ''}
      description={secret ? `Temporary password for ${secret.username}` : ''}
      footer={<Button variant="primary" onClick={onClose}>I have recorded it</Button>}
    >
      {secret ? (
        <div className="space-y-4">
          <div className="flex items-stretch gap-2">
            <code className="flex-1 rounded-md border border-line-strong bg-surface-2 px-3 py-2.5 font-mono text-[16px] tracking-wide text-ink select-all break-all">
              {secret.tempPassword}
            </code>
            <Button variant="secondary" onClick={copy} icon={copied ? 'check' : 'copy'} aria-live="polite">
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Alert tone="warn" title="Shown once">
            This is the only time the password is displayed. Give it to {secret.username} through a separate channel.
          </Alert>
          <ul className="text-[13px] text-ink-2 space-y-1.5">
            <li className="flex gap-2"><Icon name="clock" size={15} className="mt-0.5 text-ink-3" />Valid until {fmtDateTime(secret.expiresAt)} (24 hours).</li>
            <li className="flex gap-2"><Icon name="key" size={15} className="mt-0.5 text-ink-3" />Works for one sign-in only, then a new password must be chosen.</li>
            <li className="flex gap-2"><Icon name="refresh" size={15} className="mt-0.5 text-ink-3" />If it expires or is used by mistake, issue a new one from the account page.</li>
          </ul>
        </div>
      ) : null}
    </Dialog>
  );
}
