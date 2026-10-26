import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog.jsx';
import Button from '../../components/ui/Button.jsx';
import { Field, Input, Select } from '../../components/ui/Field.jsx';
import { Alert } from '../../components/ui/States.jsx';
import { post } from '../../api.js';
import { SEGMENTS, INFO_CODES, formatDmc, segmentErrors, suggestedSchema } from '../../lib/dmc.js';

const BLANK = {
  modelIdentCode: '', systemDiffCode: 'A', systemCode: '00', subSystemCode: '0', subSubSystemCode: '0',
  assyCode: '00', disassyCode: '00', disassyCodeVariant: 'A', infoCode: '040', infoCodeVariant: 'A', itemLocationCode: 'D',
};

// Identity defaults, as in the Agastya original's Create dialog and DMRL import.
const META = { languageIsoCode: 'en', countryIsoCode: 'IN', securityClassification: '01', issueNumber: '001', inWork: '00', originator: '', rpcCode: '' };

/*
  Create a data module from a shell (Agastya's S1000D 4.1 and 4.2 shells).
  The code is assembled live and each segment is checked as it is typed; the
  server checks again, stamps the identity into the shell and names the file
  from the code.
*/
export default function NewDmDialog({ open, onClose, onCreated, projectId, defaults, shells = [], refData }) {
  const [dmc, setDmc] = useState(BLANK);
  const [techName, setTechName] = useState('');
  const [infoName, setInfoName] = useState('Description');
  const [schemaType, setSchemaType] = useState('descript');
  const [schemaTouched, setSchemaTouched] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [meta, setMeta] = useState(META);
  const [learn, setLearn] = useState({ learnCode: '', learnEventCode: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDmc({ ...BLANK, ...(defaults || {}) }); setTechName(''); setInfoName('Description');
    setSchemaType('descript'); setSchemaTouched(false); setError(null);
    setTemplateId(''); setMeta(META); setLearn({ learnCode: '', learnEventCode: '' });
  }, [open, defaults]);

  const bad = useMemo(() => new Set(segmentErrors(dmc)), [dmc]);
  const set = (k, v) => {
    const next = { ...dmc, [k]: v.toUpperCase().replace(/[^A-Z0-9]/g, '') };
    setDmc(next);
    if (k === 'infoCode') {
      const known = INFO_CODES.find(([c]) => c === next.infoCode);
      if (known) setInfoName(known[1]);
      if (!schemaTouched) setSchemaType(suggestedSchema(next.infoCode));
    }
  };

  async function submit(e) {
    e.preventDefault();
    if (bad.size) { setError('Correct the highlighted code segments.'); return; }
    if (!techName.trim()) { setError('Enter the technical name (what the module is about).'); return; }
    setBusy(true); setError(null);
    try {
      const body = { dmc: { ...dmc, ...(learn.learnCode || learn.learnEventCode ? learn : {}) }, techName: techName.trim(), infoName: infoName.trim(), schemaType };
      if (templateId) body.templateId = templateId;
      for (const [k, v] of Object.entries(meta)) if (v) body[k] = v;
      const r = await post(`/api/projects/${projectId}/dms`, body);
      onCreated(r.module);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg" title="New data module"
      description="Created from a shell, with the code, titles, language, security, issue and today's date written in. The file is named from the code."
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" type="submit" form="new-dm" loading={busy}>Create data module</Button></>}>
      <form id="new-dm" onSubmit={submit} className="space-y-5" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <fieldset>
          <legend className="text-[13px] font-medium text-ink-2 mb-2">Data module code</legend>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => (
              <label key={s.key} className={`flex flex-col gap-1 ${s.width}`}>
                <span className="text-[11px] text-ink-3 truncate">{s.label}</span>
                <Input value={dmc[s.key]} onChange={(e) => set(s.key, e.target.value)} aria-invalid={bad.has(s.key) || undefined}
                  title={s.hint} aria-label={`${s.label} (${s.hint})`} className="font-mono uppercase text-center !px-1.5" maxLength={14} spellCheck={false} />
              </label>
            ))}
          </div>
          <p className="mt-3 text-[13px]">
            <span className="text-ink-3">Code </span>
            <span className={`font-mono ${bad.size ? 'text-danger' : 'text-ink'}`}>DMC-{formatDmc({ ...dmc, ...learn })}</span>
            {bad.size ? <span className="text-danger text-[12px] ml-2">({bad.size} segment{bad.size > 1 ? 's' : ''} not valid)</span> : null}
          </p>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Technical name" required hint="The item the module is about, e.g. “Cooling fan tray”.">
            {(p) => <Input {...p} value={techName} onChange={(e) => setTechName(e.target.value)} maxLength={200} autoFocus />}
          </Field>
          <Field label="Information name" hint="Filled in from the info code; edit if needed.">
            {(p) => <Input {...p} value={infoName} onChange={(e) => setInfoName(e.target.value)} maxLength={200} />}
          </Field>
          <Field label="Info code" hint="Common codes; you can also type one in the code above.">
            {(p) => (
              <Select {...p} value={INFO_CODES.some(([c]) => c === dmc.infoCode) ? dmc.infoCode : ''} onChange={(e) => e.target.value && set('infoCode', e.target.value)}>
                <option value="">Other ({dmc.infoCode || '—'})</option>
                {INFO_CODES.map(([c, l]) => <option key={c} value={c}>{c} – {l}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Schema" hint={schemaType === 'proced' ? 'Steps with preliminary and closing requirements.' : 'Levelled paragraphs, tables and figures.'}>
            {(p) => (
              <Select {...p} value={schemaType} onChange={(e) => { setSchemaType(e.target.value); setSchemaTouched(true); setTemplateId(''); }}>
                <option value="descript">Descriptive (descript)</option>
                <option value="proced">Procedural (proced)</option>
                <option value="ipd">Illustrated parts data (ipd)</option>
              </Select>
            )}
          </Field>
          <Field label="Shell" hint="The newest issue is used unless you pick one.">
            {(p) => (
              <Select {...p} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Newest ({(shells.find((x) => x.schemaType === schemaType) || {}).issue || '—'})</option>
                {shells.filter((x) => x.schemaType === schemaType).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Security classification">
            {(p) => (
              <Select {...p} value={meta.securityClassification} onChange={(e) => setMeta({ ...meta, securityClassification: e.target.value })}>
                {listWith(refData && refData.securityClasses, meta.securityClassification).map((c) => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <details className="rounded-md border border-line px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-medium text-ink-2">Language, issue and enterprise codes</summary>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <Field label="Language">
              {(p) => (
                <Select {...p} value={meta.languageIsoCode} onChange={(e) => setMeta({ ...meta, languageIsoCode: e.target.value })}>
                  {listWith(refData && refData.languages, meta.languageIsoCode).map((c) => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Country">
              {(p) => (
                <Select {...p} value={meta.countryIsoCode} onChange={(e) => setMeta({ ...meta, countryIsoCode: e.target.value })}>
                  {listWith(refData && refData.countries, meta.countryIsoCode).map((c) => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Issue number" hint="Three digits.">
              {(p) => <Input {...p} value={meta.issueNumber} onChange={(e) => setMeta({ ...meta, issueNumber: e.target.value.replace(/\D/g, '') })} maxLength={3} className="font-mono" />}
            </Field>
            <Field label="In work" hint="Two digits; 00 for a released issue.">
              {(p) => <Input {...p} value={meta.inWork} onChange={(e) => setMeta({ ...meta, inWork: e.target.value.replace(/\D/g, '') })} maxLength={2} className="font-mono" />}
            </Field>
            <Field label="Originator (CAGE)" hint="Blank keeps the shell's value.">
              {(p) => <CageInput {...p} list="dm-originators" value={meta.originator} onChange={(v) => setMeta({ ...meta, originator: v })} options={refData && refData.originators} />}
            </Field>
            <Field label="Responsible partner company (CAGE)" hint="Blank keeps the shell's value.">
              {(p) => <CageInput {...p} list="dm-rpcs" value={meta.rpcCode} onChange={(v) => setMeta({ ...meta, rpcCode: v })} options={refData && refData.rpcs} />}
            </Field>
            <Field label="Learn code" hint="Learning modules only: T or H then two characters.">
              {(p) => <Input {...p} value={learn.learnCode} onChange={(e) => setLearn({ ...learn, learnCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} maxLength={3} className="font-mono uppercase" />}
            </Field>
            <Field label="Learn event code" hint="A to E; goes with the learn code.">
              {(p) => <Input {...p} value={learn.learnEventCode} onChange={(e) => setLearn({ ...learn, learnEventCode: e.target.value.toUpperCase().replace(/[^A-E]/g, '') })} maxLength={1} className="font-mono uppercase" />}
            </Field>
          </div>
        </details>
      </form>
    </Dialog>
  );
}

// A select list that always contains the current value.
function listWith(list, value) {
  const l = list && list.length ? list : [];
  return l.some((c) => c.code === value) ? l : [{ code: value, name: '' }, ...l];
}

function CageInput({ value, onChange, options, list, ...p }) {
  return (
    <>
      <Input {...p} list={list} value={value} onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={5} className="font-mono uppercase" spellCheck={false} />
      <datalist id={list}>{(options || []).map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}</datalist>
    </>
  );
}
