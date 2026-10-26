import { useEffect, useState } from 'react';
import { Dialog } from './ui/Dialog.jsx';
import Button from './ui/Button.jsx';
import { Field, Input, Textarea } from './ui/Field.jsx';
import { Alert } from './ui/States.jsx';
import { useToast } from './ui/Toast.jsx';
import { post } from '../api.js';

// The project is owned by whoever creates it (a Project Manager or an Author).
const DESCRIPTION = {
  project_manager: 'You will own this project and can assign Authors to it.',
  author: 'You will own this project and can add other existing Authors to it.',
};

export default function NewProjectDialog({ open, onClose, onCreated, role = 'project_manager' }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setName(''); setDescription(''); setError(null); } }, [open]);

  async function submit(e) {
    e.preventDefault();
    if (name.trim().length < 3) { setError('A project name needs at least 3 characters.'); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await post('/api/projects', { name: name.trim(), description: description.trim() });
      toast.success('Project created', r.project.name);
      onCreated(r.project);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New project"
      description={`${DESCRIPTION[role] || DESCRIPTION.project_manager} The S1000D workspace (CSDB, media, publication module) is created in Phase 2.`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-project" loading={busy}>Create project</Button>
        </>
      )}>
      <form id="new-project" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Project name" required hint="Unique across the organisation, for example “RDR-A Radar Maintenance Manual”.">
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />}
        </Field>
        <Field label="Description" hint="Optional. Up to 500 characters.">
          {(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />}
        </Field>
      </form>
    </Dialog>
  );
}
