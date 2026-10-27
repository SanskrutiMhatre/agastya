import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Badge, Mono } from '../../components/ui/Badge.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Alert, EmptyState, ErrorState, LoadingBlock, Spinner } from '../../components/ui/States.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import Icon from '../../components/Icon.jsx';
import { api, get, post, put } from '../../api.js';
import BuildLog from '../../components/BuildLog.jsx';
import PdfFrame from '../../components/PdfFrame.jsx';
import useLive, { useBuildLog } from '../../lib/useLive.js';
import { useAuth } from '../../auth.jsx';
import { useOverrideSession } from '../../components/OverrideSession.jsx';
import { LockBanner } from '../../components/LockBanner.jsx';
import { fmtDateTime, fmtRelative } from '../../lib/format.js';
import StructuredEditor, { Inspector } from '../../editor/StructuredEditor.jsx';
import { contentModelFor } from '../../schema/contentModel.js';
import { parseXml } from '../../editor/xmlDoc.js';

// Monaco is large: loaded only when the XML panel is shown.
const XmlPanel = lazy(() => import('../../editor/XmlPanel.jsx'));
const VIEW_KEY = 'agastya-editor-view';
const VIEWS = [['document', 'Document'], ['split', 'Split'], ['xml', 'XML']];

/*
  Data module editor (checkpoint 2c): a structured, schema-aware document
  view with an element inspector, and the Monaco XML panel, alone or side by
  side. Both edit the same XML text, which is what is saved (revision-based
  conflict detection), validated (XSD + BREX), previewed as PDF, kept in the
  revision history and autosaved as a draft. A notice appears when someone
  else saves the module, and a locked module is read-only.
*/

function Findings({ result, onJump }) {
  if (!result) return <p className="px-5 pb-5 text-[13px] text-ink-3">Run Validate to check the module against its S1000D schema and the project BREX.</p>;
  const errors = result.findings.filter((f) => f.sev === 'error');
  const infos = result.findings.filter((f) => f.sev !== 'error');
  return (
    <div className="px-5 pb-5 space-y-3">
      <div className="flex flex-wrap gap-2 text-[13px]">
        {result.valid ? <Badge tone="ok" icon="checkCircle">Valid</Badge> : <Badge tone="danger" icon="alert">{errors.length} problem{errors.length === 1 ? '' : 's'}</Badge>}
        <span className="text-ink-3">Schema: {result.schema || 'not checked'}</span>
        <span className="text-ink-3">BREX: {result.brex.source ? `${result.brex.evaluated} rules evaluated` : 'not checked'}</span>
      </div>
      {errors.length ? (
        <ul className="divide-y divide-line rounded-md border border-line max-h-72 overflow-y-auto">
          {errors.map((f, i) => (
            <li key={i}>
              <button type="button" onClick={() => onJump(f.line)} className="w-full text-left flex gap-2 px-3 py-2 hover:bg-surface-2 text-[13px]">
                <Badge tone={f.kind === 'brex' ? 'warn' : 'danger'}>{f.kind === 'brex' ? 'BREX' : 'XSD'}</Badge>
                <span className="font-mono text-[12px] text-ink-3 shrink-0">L{f.line}</span>
                <span className="text-ink-2 min-w-0">{f.message}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {infos.map((f, i) => <p key={i} className="text-[12px] text-ink-3 flex gap-1.5"><Icon name="info" size={14} className="mt-0.5" />{f.message}</p>)}
    </div>
  );
}

export default function DmEditor() {
  const { id, dmId } = useParams();
  const toast = useToast();
  const [view, setViewState] = useState(() => { try { return localStorage.getItem(VIEW_KEY) || 'document'; } catch { return 'document'; } });
  const setView = (v) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ } };
  const [selected, setSelected] = useState(null);
  const [showTags, setShowTags] = useState(true);
  const [history, setHistory] = useState({ undo: [], redo: [] });
  const [revealLine, setRevealLine] = useState(null);
  const problemsRef = useRef([]);
  const [problems, setProblems] = useState([]);
  const [state, setState] = useState({ loading: true });
  const [xml, setXml] = useState('');
  const [base, setBase] = useState(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [validation, setValidation] = useState(null);
  const [revisions, setRevisions] = useState(null);
  const [viewRev, setViewRev] = useState(null);
  const [draft, setDraft] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [newer, setNewer] = useState(null);
  const [preview, setPreview] = useState(null);
  const draftTimer = useRef(null);
  const { me } = useAuth();
  const draftUrl = `/api/projects/${id}/drafts/dm-${dmId}`;
  // The administrator edits a module only inside an override session with a reason (decisions.md V3).
  const ov = useOverrideSession({
    projectId: id, docKey: `dm-${dmId}`, label: 'this data module',
    enabled: !!(state.perms && state.perms.override) && !(state.module && state.module.deletedAt),
  });
  const readOnly = state.loading || !state.perms || state.serverReadOnly || !(state.perms.write || ov.active) || (!!state.lock && !ov.active);
  const keepsDrafts = !!(state.perms && state.perms.drafts);

  const load = useCallback(async () => {
    setState({ loading: true });
    try {
      const [p, d] = await Promise.all([get(`/api/projects/${id}`), get(`/api/projects/${id}/dms/${dmId}`)]);
      setState({ loading: false, project: p.project, perms: p.permissions, module: d.module, serverReadOnly: !!d.readOnly, lock: d.lock || null, revBy: d.revisionBy, revAt: d.revisionAt });
      setXml(d.xml); setSaved(d.xml); setBase(d.revision); setValidation(null); setRevisions(null); setNewer(null); setDraftSavedAt(null);
      setSelected(null); setHistory({ undo: [], redo: [] });
      if (p.permissions.drafts && !d.readOnly) {
        try { const dr = (await get(`/api/projects/${id}/drafts/dm-${dmId}`)).draft; setDraft(dr && dr.content !== d.xml ? dr : null); } catch { setDraft(null); }
      } else setDraft(null);
    } catch (e) { setState({ loading: false, error: e }); }
  }, [id, dmId]);

  /*
    A save made elsewhere (another person, or this user in another tab): say
    so now, before a save from here would be refused. A revision newer than
    the one this editor is based on is the test; this tab's own save in
    flight is ignored.
  */
  const baseRef = useRef(null);
  baseRef.current = base;
  const savingRef = useRef(false);
  useLive(id, {
    onContent: (e) => {
      if (e.docId !== dmId || savingRef.current) return;
      if (e.action === 'dm.saved') { if (!e.revision || (baseRef.current && e.revision <= baseRef.current)) return; }
      else if (!['dm.deleted', 'dm.restored'].includes(e.action)) return;
      setNewer({ by: e.byId === me.user.id ? 'You (in another tab or window)' : e.by, revision: e.revision, action: e.action });
    },
  });
  const { log: previewLog, setLog: setPreviewLog } = useBuildLog(id, (e) => e.kind === 'preview' && state.module && e.target === state.module.dmc);
  useEffect(() => { load(); }, [load]);

  const dirty = xml !== saved;
  // Autosave unsaved work as this user's draft, two seconds after the last keystroke.
  useEffect(() => {
    if (readOnly || !keepsDrafts || !dirty || !base) return undefined;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      put(draftUrl, { content: xml, baseRevision: base }).then((r) => setDraftSavedAt(r.savedAt)).catch(() => { /* retried on the next change */ });
    }, 2000);
    return () => clearTimeout(draftTimer.current);
  }, [xml, dirty, base, readOnly, keepsDrafts, draftUrl]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useCallback(async () => {
    if (readOnly || !dirty || busy) return;
    setBusy('save'); setSaveError(null);
    savingRef.current = true;
    try {
      const r = await put(`/api/projects/${id}/dms/${dmId}`, { xml, baseRevision: base });
      baseRef.current = r.revision;
      clearTimeout(draftTimer.current);
      setBase(r.revision); setSaved(xml); setDraft(null); setDraftSavedAt(null); setNewer(null);
      setState((s) => ({ ...s, module: r.module, revBy: 'you', revAt: new Date().toISOString() }));
      setRevisions(null);
      toast.success('Saved', 'A new revision was recorded.');
    } catch (e) {
      if (e.code === 'CONFLICT') {
        // The refused text is kept as the user's draft now, not when the autosave timer would have fired (decisions.md B11).
        clearTimeout(draftTimer.current);
        if (keepsDrafts) await put(draftUrl, { content: xml, baseRevision: base }).catch(() => { /* the conflict dialog still offers to copy it */ });
        setConflict(e.body.conflict);
      } else setSaveError(e);
    }
    savingRef.current = false;
    setBusy(null);
  }, [readOnly, dirty, busy, id, dmId, xml, base, toast, keepsDrafts, draftUrl]);

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  async function validate() {
    setBusy('validate');
    try { setValidation(await post(`/api/projects/${id}/dms/${dmId}/validate`, { xml })); } catch (e) { toast.error('Validation failed', e.message); }
    setBusy(null);
  }

  async function buildPreview() {
    if (dirty) { toast.info('Save first', 'The preview is built from the saved module.'); return; }
    setBusy('preview'); setPreviewLog(null); setPreview((p) => (p ? { ...p, error: null } : null));
    try {
      const res = await fetch(`/api/projects/${id}/dms/${dmId}/preview`, { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) {
        let b = null;
        try { b = await res.json(); } catch { b = null; }
        throw Object.assign(new Error((b && b.error) || `Preview failed (${res.status}).`), { body: b });
      }
      setPreview({ version: Date.now(), ms: Number(res.headers.get('X-Build-Ms')) || null });
    } catch (e) {
      setPreview({ error: e });
    }
    setBusy(null);
  }

  async function openRevisions() {
    try { setRevisions((await get(`/api/projects/${id}/dms/${dmId}/revisions`)).revisions); } catch (e) { toast.error('Could not load history', e.message); }
  }

  // A finding's line: shown in the XML panel (opened beside the document if needed).
  function jump(line) {
    if (view === 'document') setView('split');
    setRevealLine({ line, at: Date.now() });
  }

  // A structured edit: the new text, with one undo step.
  const structuredChange = useCallback((next) => {
    setHistory((h) => ({ undo: [...h.undo.slice(-99), xml], redo: [] }));
    setXml(next);
  }, [xml]);
  const undo = () => setHistory((h) => {
    if (!h.undo.length) return h;
    const prev = h.undo[h.undo.length - 1];
    setXml(prev);
    return { undo: h.undo.slice(0, -1), redo: [...h.redo, xml] };
  });
  const redo = () => setHistory((h) => {
    if (!h.redo.length) return h;
    const next = h.redo[h.redo.length - 1];
    setXml(next);
    return { undo: [...h.undo, xml], redo: h.redo.slice(0, -1) };
  });

  const model = useMemo(() => (state.module ? contentModelFor(state.module.issue, state.module.schemaType) : null), [state.module]);
  useEffect(() => { const t = setTimeout(() => setProblems(problemsRef.current || []), 0); return () => clearTimeout(t); }, [xml, view]);
  // Markers for the XML panel: a parse error, else the last validation's findings.
  const markers = useMemo(() => {
    const p = parseXml(xml);
    if (p.error) return [{ line: p.error.line, message: p.error.message, severity: 'error' }];
    return validation ? validation.findings.filter((f) => f.sev === 'error' && f.line).map((f) => ({ line: f.line, message: `${f.kind === 'brex' ? 'BREX' : 'XSD'}: ${f.message}`, severity: f.kind === 'brex' ? 'warning' : 'error' })) : [];
  }, [xml, validation]);

  const back = <Link to={`/projects/${id}?tab=dms`} className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink mb-4"><Icon name="arrowLeft" size={15} />Data modules</Link>;
  if (state.loading) return <>{back}<Card className="p-6"><LoadingBlock rows={8} /></Card></>;
  if (state.error) return <>{back}<Card>{state.error.status === 404 ? <EmptyState icon="file" title="Data module not found">It does not exist, or it is not in a project you can see.</EmptyState> : <ErrorState error={state.error} onRetry={load} />}</Card></>;
  const m = state.module;

  return (
    <>
      {back}
      <header className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <p className="font-mono text-[12.5px] text-ink-2">DMC-{m.dmc}</p>
          <h1 className="text-[20px] font-semibold text-ink">{m.techName}{m.infoName ? <span className="text-ink-3 font-normal"> – {m.infoName}</span> : null}</h1>
          <p className="text-[13px] text-ink-3 mt-1 flex flex-wrap items-center gap-2">
            <Badge>{m.schemaType}</Badge>{m.issue ? <Badge>S1000D {m.issue}</Badge> : null}
            <span>{state.project.name}</span>·<span>{state.revAt ? `saved ${fmtRelative(state.revAt)}${state.revBy ? ` by ${state.revBy}` : ''}` : 'not saved yet'}</span>
            {m.deletedAt ? <Badge tone="danger" icon="trash">Deleted</Badge> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon="list" onClick={openRevisions}>History</Button>
          <Button icon="checkCircle" onClick={validate} loading={busy === 'validate'}>Validate</Button>
          <Button icon="book" onClick={buildPreview} loading={busy === 'preview'} disabled={!!m.deletedAt}>Preview PDF</Button>
          {!readOnly ? <Button variant="primary" icon="check" onClick={save} loading={busy === 'save'} disabled={!dirty}>{dirty ? 'Save' : 'Saved'}</Button> : null}
        </div>
      </header>

      {draft && !readOnly ? (
        <Alert tone="info" className="mb-4" title="You have an unsaved draft of this module">
          Autosaved {fmtRelative(draft.updatedAt)}{draft.baseRevision && draft.baseRevision !== base ? `, from revision ${draft.baseRevision} (the module has been saved since; check before you save)` : ''}.
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => { setXml(draft.content); setDraft(null); toast.info('Draft restored', 'Save to make it the current version.'); }}>Restore draft</Button>
            <Button size="sm" variant="ghost" onClick={async () => { try { await api(draftUrl, { method: 'DELETE' }); } catch { /* gone */ } setDraft(null); }}>Discard draft</Button>
          </div>
        </Alert>
      ) : null}
      {newer ? (
        <Alert tone="warn" className="mb-4" title={newer.action === 'dm.deleted' ? `${newer.by || 'Someone'} deleted this module` : `${newer.by || 'Someone'} saved a newer version`}>
          {newer.revision ? `Revision ${newer.revision}. ` : ''}{dirty ? 'Saving now will be refused; your text is kept in your draft.' : 'Load it to see their changes.'}
          <div className="mt-2"><Button size="sm" icon="refresh" onClick={load}>Load the latest version</Button></div>
        </Alert>
      ) : null}
      {ov.bar ? <div className="mb-4">{ov.bar}</div> : null}
      {state.lock ? <LockBanner lock={state.lock} override={ov.active} what="This data module" className="mb-4" /> : null}
      {readOnly && !state.lock && !(state.perms && state.perms.override && !m.deletedAt) ? <Alert tone="info" className="mb-4">{m.deletedAt ? 'This data module is deleted. Restore it from the list to edit it.' : 'You can read this data module but not edit it.'}</Alert> : null}
      {saveError ? <Alert className="mb-4" title="Not saved">{saveError.message}{saveError.body && saveError.body.line ? ' ' : ''}{saveError.body && saveError.body.line ? <button type="button" className="underline" onClick={() => jump(saveError.body.line)}>Go to line {saveError.body.line}</button> : null}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-line bg-surface-2 text-[12px] text-ink-3">
            <div role="radiogroup" aria-label="Editor view" className="flex items-center rounded-md border border-line p-0.5 bg-surface">
              {VIEWS.map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}
                  className={`px-2.5 py-1 rounded text-[12.5px] font-medium ${view === v ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:text-ink'}`}>{label}</button>
              ))}
            </div>
            <span className="flex items-center gap-2">
              {view !== 'xml' ? (
                <>
                  <label className="flex items-center gap-1.5 text-ink-2"><input type="checkbox" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} />Tags</label>
                  {!readOnly ? (
                    <>
                      <Button size="sm" variant="ghost" icon="undo" onClick={undo} disabled={!history.undo.length} aria-label="Undo the last structured edit">Undo</Button>
                      <Button size="sm" variant="ghost" onClick={redo} disabled={!history.redo.length} aria-label="Redo">Redo</Button>
                    </>
                  ) : null}
                </>
              ) : null}
              <span className="font-mono tabular" data-testid="editor-status">{model ? model.key : ''}{dirty ? ' · unsaved' : ''}{dirty && draftSavedAt ? ' · draft autosaved' : ''}</span>
            </span>
          </div>
          <div className={view === 'split' ? 'grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-line' : ''}>
            {view !== 'xml' ? (
              <div className="h-[62vh] min-h-80 overflow-auto bg-surface">
                <StructuredEditor xml={xml} onChange={structuredChange} readOnly={readOnly} model={model}
                  selected={selected} onSelect={setSelected} showTags={showTags} problemsRef={problemsRef} />
              </div>
            ) : null}
            {view !== 'document' ? (
              <Suspense fallback={<div className="h-[62vh] grid place-items-center text-ink-3"><Spinner label="Loading the XML panel" /></div>}>
                <div data-readonly={readOnly ? 'true' : 'false'}>
                  <XmlPanel value={xml} onChange={setXml} readOnly={readOnly} contentModel={model} markers={markers} revealLine={revealLine} />
                </div>
              </Suspense>
            ) : null}
          </div>
        </Card>
        <div className="space-y-6">
          {view !== 'xml' ? (
            <Card>
              <CardHeader title="Element" subtitle={readOnly ? 'Read-only' : 'Attributes and what the schema allows here'} />
              <Inspector xml={xml} onChange={structuredChange} readOnly={readOnly} model={model} selected={selected} onSelect={setSelected} problems={problems} />
            </Card>
          ) : null}
          {previewLog || preview ? (
            <Card>
              <CardHeader title="Preview" subtitle="This module alone, without front matter" />
              <div className="px-5 pb-5 space-y-3">
                <BuildLog log={previewLog} title="Building the preview" />
                {preview && preview.version ? <p className="text-[13px] text-ok">Built{preview.ms ? ` in ${(preview.ms / 1000).toFixed(1)} s` : ''}; shown below the editor.</p> : null}
                {preview && preview.error ? <Alert title="The preview failed">{preview.error.message}{preview.error.body && preview.error.body.hint ? <p className="mt-1">{preview.error.body.hint}</p> : null}</Alert> : null}
              </div>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Validation" subtitle="XSD for the declared S1000D issue, then the project BREX" />
            <Findings result={validation} onJump={jump} />
          </Card>
          <Card>
            <CardHeader title="Details" />
            <dl className="px-5 pb-5 text-[13px] space-y-2">
              <div className="flex justify-between gap-3"><dt className="text-ink-3">File</dt><dd><Mono>csdb/{m.file}</Mono></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Status</dt><dd>{m.status.replace('_', ' ')}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Created</dt><dd>{fmtDateTime(m.createdAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Updated</dt><dd>{fmtDateTime(m.updatedAt)}{m.updatedBy ? ` by ${m.updatedBy}` : ''}</dd></div>
            </dl>
          </Card>
        </div>
      </div>

      {preview && preview.version ? (
        <div className="mt-6"><PdfFrame src={`/api/projects/${id}/dms/${dmId}/preview.pdf`} version={preview.version} title={`Preview of DMC-${m.dmc}`} height="80vh" onClose={() => setPreview(null)} /></div>
      ) : null}

      <Dialog open={!!conflict} onClose={() => setConflict(null)} title="Someone else saved this module" size="md"
        description={conflict ? `Revision ${conflict.current} was saved ${conflict.updatedAt ? fmtRelative(conflict.updatedAt) : ''}${conflict.updatedBy ? ` by ${conflict.updatedBy}` : ''} after you opened it. Your changes were not saved.` : ''}
        footer={<>
          <Button onClick={async () => { try { await navigator.clipboard.writeText(xml); toast.success('Your XML is on the clipboard'); } catch { toast.error('Could not copy'); } }} icon="copy">Copy my XML</Button>
          <Button variant="primary" icon="refresh" onClick={() => { setConflict(null); load(); }}>Load the latest version</Button>
        </>}>
        <p className="text-ink-2">Your text is kept as your draft (and you can copy it now). Load the latest version, then restore your draft or apply your changes again. Nothing is merged automatically.</p>
      </Dialog>

      <Dialog open={!!revisions} onClose={() => setRevisions(null)} title="Revision history" size="lg" description="Every save is kept and cannot be changed.">
        {revisions ? (
          <ul className="divide-y divide-line rounded-md border border-line max-h-[60vh] overflow-y-auto">
            {revisions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
                <span className="font-mono tabular text-ink">#{r.id}</span>
                <span className="text-ink-2 flex-1 min-w-0">{r.reason}{r.by ? ` · ${r.by}` : ''}</span>
                <span className="text-ink-3">{fmtDateTime(r.createdAt)}</span>
                <Button size="sm" variant="ghost" onClick={async () => {
                  try { const v = await get(`/api/projects/${id}/dms/${dmId}/revisions/${r.id}`); setViewRev(v); } catch (e) { toast.error('Could not open revision', e.message); }
                }}>View</Button>
              </li>
            ))}
          </ul>
        ) : null}
      </Dialog>

      <Dialog open={!!viewRev} onClose={() => setViewRev(null)} size="lg" title={viewRev ? `Revision #${viewRev.revision.id}` : ''}
        description={viewRev ? `${viewRev.revision.reason}, ${fmtDateTime(viewRev.revision.createdAt)}${viewRev.revision.by ? ` by ${viewRev.revision.by}` : ''}` : ''}
        footer={!readOnly ? <Button variant="primary" onClick={() => { setXml(viewRev.xml); setViewRev(null); setRevisions(null); toast.info('Revision loaded into the editor', 'Save to make it the current version.'); }}>Load into editor</Button> : null}>
        {viewRev ? <pre className="max-h-[55vh] overflow-auto rounded-md border border-line bg-surface-2 p-3 font-mono text-[12px] text-ink whitespace-pre">{viewRev.xml}</pre> : null}
      </Dialog>
    </>
  );
}
