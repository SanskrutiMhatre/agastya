import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog.jsx';
import Button from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/States.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Select } from '../../components/ui/Field.jsx';
import { postForm } from '../../api.js';

/*
  DMRL spreadsheet import: upload -> preview (recognised columns, rows,
  skipped rows with reasons, rows that already exist) -> import the ticked
  rows. The server re-reads the file on import; nothing is written by the
  preview.
*/
export default function DmrlDialog({ open, onClose, onDone, projectId }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // One schema for the whole import, as in the original (default descriptive).
  const [schemaType, setSchemaType] = useState('descript');
  useEffect(() => { if (open) { setFile(null); setPreview(null); setResult(null); setError(null); setPicked(new Set()); setSchemaType('descript'); } }, [open]);

  async function choose(f, schema = schemaType) {
    if (!f) return;
    setFile(f); setBusy(true); setError(null); setResult(null);
    try {
      const p = await postForm(`/api/projects/${projectId}/dmrl/preview`, { schemaType: schema }, f);
      setPreview(p);
      setPicked(new Set(p.rows.filter((r) => !r.exists).map((r) => r.row)));
    } catch (e) { setError(e.message); setPreview(null); }
    setBusy(false);
  }

  async function doImport() {
    setBusy(true); setError(null);
    try {
      const r = await postForm(`/api/projects/${projectId}/dmrl/import`, { schemaType, rows: [...picked].sort((a, b) => a - b).join(',') }, file);
      setResult(r);
      onDone();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const toggle = (row) => setPicked((s) => { const n = new Set(s); if (n.has(row)) n.delete(row); else n.add(row); return n; });

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} size="lg" title="Import from a DMRL spreadsheet"
      description="Planned data modules are created from the shell, one per selected row. Existing codes are skipped."
      footer={result
        ? <Button variant="primary" onClick={onClose}>Done</Button>
        : <><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={doImport} loading={busy} disabled={!preview || !picked.size}>Import {picked.size || ''} row{picked.size === 1 ? '' : 's'}</Button></>}>
      <div className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        {!result ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button icon="table" onClick={() => input.current && input.current.click()} disabled={busy}>{file ? 'Choose another file' : 'Choose .xlsx file'}</Button>
            <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" tabIndex={-1}
              onChange={(e) => { choose(e.target.files[0]); e.target.value = ''; }} aria-label="Choose DMRL spreadsheet" />
            <div className="w-56">
              <Select aria-label="Schema for the new modules" value={schemaType} disabled={busy} onChange={(e) => { setSchemaType(e.target.value); if (file) choose(file, e.target.value); }}>
                <option value="descript">All descriptive</option>
                <option value="proced">All procedural</option>
                <option value="ipd">All illustrated parts data</option>
                <option value="auto">By info code</option>
              </Select>
            </div>
            {file ? <span className="font-mono text-[12px] text-ink-2 truncate">{file.name}</span> : <span className="text-[13px] text-ink-3">Sheet "DMRL" or the first sheet; header row within the first 10 rows.</span>}
          </div>
        ) : null}

        {preview && !result ? (
          <>
            <p className="text-[13px] text-ink-3">Sheet <span className="text-ink">{preview.sheetName}</span> · {preview.rows.length} rows read · {preview.skipped.length} skipped</p>
            <div className="max-h-72 overflow-auto rounded-md border border-line">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-surface-2"><tr className="text-left text-ink-3 text-[12px]">
                  <th className="px-3 py-2"><span className="sr-only">Select</span></th><th className="px-2 py-2">Row</th><th className="px-2 py-2">Code</th><th className="px-2 py-2">Title</th><th className="px-2 py-2">Schema</th>
                </tr></thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.row} className="border-t border-line">
                      <td className="px-3 py-1.5"><input type="checkbox" checked={picked.has(r.row)} disabled={r.exists} onChange={() => toggle(r.row)} aria-label={`Import row ${r.row}`} /></td>
                      <td className="px-2 py-1.5 tabular text-ink-3">{r.row}</td>
                      <td className="px-2 py-1.5 font-mono text-[12px]">{r.dmc}</td>
                      <td className="px-2 py-1.5">{r.techName}{r.infoName ? ` – ${r.infoName}` : ''} {r.exists ? <Badge>exists</Badge> : null}</td>
                      <td className="px-2 py-1.5 text-ink-3">{r.schemaType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.skipped.length ? (
              <Alert tone="warn" title="Skipped rows">
                <ul className="list-disc pl-4">{preview.skipped.slice(0, 20).map((s) => <li key={`${s.row}-${s.reason}`}>{s.row ? `Row ${s.row}: ` : ''}{s.reason}</li>)}</ul>
              </Alert>
            ) : null}
          </>
        ) : null}

        {result ? (
          <Alert tone="ok" title={`${result.created.length} data module${result.created.length === 1 ? '' : 's'} created`}>
            {result.duplicates.length ? `${result.duplicates.length} already existed. ` : ''}{result.skipped.length ? `${result.skipped.length} rows were skipped.` : ''}
          </Alert>
        ) : null}
      </div>
    </Dialog>
  );
}
