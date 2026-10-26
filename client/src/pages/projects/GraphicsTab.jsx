import { useEffect, useRef, useState } from 'react';
import { Card } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Field, Input } from '../../components/ui/Field.jsx';
import { Badge, Mono } from '../../components/ui/Badge.jsx';
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import useResource from '../../lib/useResource.js';
import { get, postForm } from '../../api.js';
import { fmtRelative } from '../../lib/format.js';

function UploadDialog({ open, onClose, onDone, projectId, icn: presetIcn }) {
  const input = useRef(null);
  const [icn, setIcn] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  useEffect(() => { if (open) { setIcn(presetIcn || ''); setTitle(''); setFile(null); setError(null); setResult(null); } }, [open, presetIcn]);

  async function submit(e) {
    e.preventDefault();
    if (!file) { setError('Choose an image file.'); return; }
    setBusy(true); setError(null);
    try { const r = await postForm(`/api/projects/${projectId}/graphics`, { icn: icn.trim(), title: title.trim() }, file); setResult(r); onDone(); }
    catch (err) { setError(err.message); }
    setBusy(false);
  }
  async function suggest() {
    try { const r = await get(`/api/projects/${projectId}/graphics/next-icn`); setIcn(r.icn); } catch (err) { setError(err.message); }
  }

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} title="Upload a graphic"
      description="PNG, JPEG or GIF, up to 64 MB. The file is stored where the PDF build will look for this ICN."
      footer={result ? <Button variant="primary" onClick={onClose}>Done</Button>
        : <><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" type="submit" form="upload-icn" loading={busy}>Upload</Button></>}>
      {result ? (
        <Alert tone={result.resolves ? 'ok' : 'warn'} title={result.resolves ? 'Uploaded' : 'Uploaded, but it will not appear in the PDF yet'}>
          Stored as <Mono>{result.file}</Mono>.{result.warning ? ` ${result.warning}` : ''}
        </Alert>
      ) : (
        <form id="upload-icn" onSubmit={submit} className="space-y-4" noValidate>
          {error ? <Alert>{error}</Alert> : null}
          <Field label="ICN" hint="Leave empty to take it from the file name, e.g. ICN-AGS-A-240000-A-0AGS1-00001-A-01-1.png. The case you type is kept.">
            {(p) => (
              <div className="flex gap-2">
                <Input {...p} className="font-mono flex-1" value={icn} onChange={(e) => setIcn(e.target.value)} maxLength={90} spellCheck={false} />
                {!presetIcn ? <Button type="button" size="sm" variant="secondary" onClick={suggest}>Suggest</Button> : null}
              </div>
            )}
          </Field>
          <Field label="Title" hint="Optional, for the registry.">
            {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />}
          </Field>
          <div className="flex items-center gap-3">
            <Button icon="plus" onClick={() => input.current && input.current.click()}>Choose image</Button>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/gif" className="sr-only" tabIndex={-1} aria-label="Choose image"
              onChange={(e) => { setFile(e.target.files[0] || null); e.target.value = ''; }} />
            <span className="text-[13px] text-ink-2 truncate">{file ? file.name : 'No file chosen'}</span>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export default function GraphicsTab({ project, canWrite }) {
  const toast = useToast();
  const { data, loading, error, reload } = useResource(`/api/projects/${project.id}/graphics`);
  const [upload, setUpload] = useState(null);
  if (error) return <Card><ErrorState error={error} onRetry={reload} /></Card>;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line">
        <p className="text-[13px] text-ink-3 flex-1">
          {data ? `${data.counts.total} graphic${data.counts.total === 1 ? '' : 's'} referenced or registered · ` : ''}
          {data && data.counts.missing ? <span className="text-danger">{data.counts.missing} missing</span> : data ? 'none missing' : ''}
        </p>
        {canWrite ? <Button size="sm" variant="primary" icon="plus" onClick={() => setUpload({ icn: '' })}>Upload graphic</Button> : null}
      </div>
      {loading ? <div className="p-4"><LoadingBlock rows={4} /></div> : (
        <DataTable
          caption="Graphics"
          rows={data.graphics}
          rowKey={(g) => g.icn}
          initialSort={{ key: 'status', dir: 'asc' }}
          empty={<EmptyState icon="layers" title="No graphics yet">Figures in data modules refer to graphics by ICN; they appear here once referenced or uploaded.</EmptyState>}
          columns={[
            { key: 'thumb', header: <span className="sr-only">Preview</span>, render: (g) => (g.present
              ? <img src={`/api/projects/${project.id}/graphics/${encodeURIComponent(g.icn)}/file`} alt="" className="h-10 w-16 object-contain rounded border border-line bg-white" loading="lazy" />
              : <span className="grid h-10 w-16 place-items-center rounded border border-dashed border-line-strong text-[10px] text-ink-3">none</span>) },
            { key: 'icn', header: 'ICN', sortValue: (g) => g.icn, render: (g) => <div><Mono className="!text-[12px] text-ink">{g.icn}</Mono>{g.title ? <p className="text-[12px] text-ink-3">{g.title}</p> : null}</div> },
            { key: 'status', header: 'Status', sortValue: (g) => (g.present ? (g.resolves ? 2 : 1) : 0), render: (g) => (!g.present
              ? <Badge tone="danger" icon="alert">Missing</Badge>
              : g.resolves ? <Badge tone="ok" icon="checkCircle">Will print</Badge> : <Badge tone="warn" icon="alert">Wrong place</Badge>) },
            { key: 'used', header: 'Used by', sortValue: (g) => g.usedBy.length, render: (g) => (g.usedBy.length ? <span className="font-mono text-[12px] text-ink-2">{g.usedBy.slice(0, 2).join(', ')}{g.usedBy.length > 2 ? ` +${g.usedBy.length - 2}` : ''}</span> : <span className="text-ink-3">not used</span>), hideBelow: 'md' },
            { key: 'expected', header: 'Build looks for', render: (g) => <Mono className="!text-[12px]">{g.expected}</Mono>, hideBelow: 'lg' },
            { key: 'uploaded', header: 'Uploaded', sortValue: (g) => g.uploadedAt || '', render: (g) => <span className="text-ink-2">{g.uploadedAt ? fmtRelative(g.uploadedAt) : '—'}</span>, hideBelow: 'lg' },
            ...(canWrite ? [{ key: 'act', header: <span className="sr-only">Actions</span>, align: 'right', render: (g) => (
              <Button size="sm" variant={g.present ? 'ghost' : 'secondary'} onClick={() => setUpload({ icn: g.icn })}>{g.present ? 'Replace' : 'Upload'}</Button>
            ) }] : []),
          ]}
        />
      )}
      <UploadDialog open={!!upload} icn={upload && upload.icn} projectId={project.id} onClose={() => setUpload(null)}
        onDone={() => { reload(); toast.success('Graphic uploaded'); }} />
    </Card>
  );
}
