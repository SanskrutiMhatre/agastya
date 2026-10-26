import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog.jsx';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/Icon.jsx';
import { Alert } from '../../components/ui/States.jsx';
import { post } from '../../api.js';

/*
  Import S1000D data module XML files. Each file is sent as text and goes
  through the server's write path (safety guard, well-formedness, the code
  read from its dmIdent). Results are reported per file.
*/
export default function ImportDialog({ open, onClose, onDone, projectId }) {
  const input = useRef(null);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  useEffect(() => { if (open) { setResults([]); setBusy(false); } }, [open]);

  async function importFiles(files) {
    const list = [...files].filter((f) => /\.xml$/i.test(f.name));
    if (!list.length) { setResults([{ name: 'No .xml files chosen', ok: false, message: 'Choose one or more S1000D data module .xml files.' }]); return; }
    setBusy(true);
    const out = [];
    for (const f of list) {
      try {
        if (f.size > 8 * 1024 * 1024) throw new Error('Larger than 8 MB.');
        const r = await post(`/api/projects/${projectId}/dms/import`, { filename: f.name, content: await f.text() });
        out.push({ name: f.name, ok: true, message: `Imported as ${r.module.dmc}` });
      } catch (e) {
        out.push({ name: f.name, ok: false, message: e.message });
      }
      setResults([...out]);
    }
    setBusy(false);
    if (out.some((r) => r.ok)) onDone();
  }

  const okCount = results.filter((r) => r.ok).length;
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} size="lg" title="Import XML data modules"
      description="Each file is checked for unsafe XML and must be a well-formed S1000D data module. It is named from its own data module code."
      footer={<Button variant="primary" onClick={onClose} disabled={busy}>Done</Button>}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) importFiles(e.dataTransfer.files); }}
        className={`rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${drag ? 'border-accent bg-accent-soft' : 'border-line-strong'}`}>
        <Icon name="file" size={26} className="mx-auto text-ink-3" />
        <p className="mt-2 text-ink-2">Drop .xml files here, or</p>
        <Button className="mt-2" icon="plus" onClick={() => input.current && input.current.click()} disabled={busy}>Choose files</Button>
        <input ref={input} type="file" accept=".xml,text/xml,application/xml" multiple className="sr-only" tabIndex={-1}
          onChange={(e) => { importFiles(e.target.files); e.target.value = ''; }} aria-label="Choose XML files" />
      </div>
      {results.length ? (
        <div className="mt-4" aria-live="polite">
          <p className="text-[13px] text-ink-3 mb-2">{busy ? 'Importing…' : `${okCount} of ${results.length} imported`}</p>
          <ul className="divide-y divide-line rounded-md border border-line max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <li key={i} className="flex gap-2 px-3 py-2 text-[13px]">
                <Icon name={r.ok ? 'checkCircle' : 'alert'} size={16} className={`mt-0.5 ${r.ok ? 'text-ok' : 'text-danger'}`} />
                <div className="min-w-0"><p className="font-mono text-[12px] text-ink truncate">{r.name}</p><p className={r.ok ? 'text-ink-3' : 'text-danger'}>{r.message}</p></div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {!results.length ? <Alert tone="info" className="mt-4">Archives (.zip) are not imported; extract them first.</Alert> : null}
    </Dialog>
  );
}
