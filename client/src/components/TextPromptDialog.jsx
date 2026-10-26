import { useEffect, useState } from 'react';
import { Dialog } from './ui/Dialog.jsx';
import Button from './ui/Button.jsx';
import { Field, Input } from './ui/Field.jsx';

// A one-field dialog (rename a chapter, name a new one).
export default function TextPromptDialog({ open, onClose, onSubmit, title, label, initial = '', confirmLabel = 'Save', maxLength = 300 }) {
  const [value, setValue] = useState(initial);
  useEffect(() => { if (open) setValue(initial); }, [open, initial]);
  const submit = (e) => { e.preventDefault(); const v = value.trim(); if (v) onSubmit(v); };
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="text-prompt" disabled={!value.trim()}>{confirmLabel}</Button></>}>
      <form id="text-prompt" onSubmit={submit}>
        <Field label={label}>{(p) => <Input {...p} value={value} onChange={(e) => setValue(e.target.value)} maxLength={maxLength} autoFocus />}</Field>
      </form>
    </Dialog>
  );
}
