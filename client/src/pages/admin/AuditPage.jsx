import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, PageHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Badge, Mono } from '../../components/ui/Badge.jsx';
import { Field, Input, Select } from '../../components/ui/Field.jsx';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import Icon from '../../components/Icon.jsx';
import { fetchBlob, get } from '../../api.js';
import { describeAction, fmtDateTime, isFailureAction } from '../../lib/format.js';

const CATEGORIES = [
  ['auth', 'Sign-in and sessions'], ['user', 'Accounts'], ['reset', 'Password resets'], ['project', 'Projects and members'],
  ['dm', 'Data modules'], ['publication', 'Publication'], ['graphic', 'Graphics'], ['request', 'Approval requests'],
  ['admin', 'Administrator overrides'], ['override', 'Override editing sessions'], ['audit', 'Audit exports'],
];
const FILTERS = ['user', 'category', 'action', 'project', 'from', 'to'];

// The listed details of one entry, as the server presents them (allowed fields only; decisions.md V10).
function Details({ d }) {
  const entries = Object.entries(d || {});
  if (!entries.length) return <span className="text-ink-3">—</span>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12px]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className={`min-w-0 break-words ${k === 'reason' ? 'text-ink' : 'text-ink-2'}`}>{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

/*
  The audit log (decisions.md V9, V10): every recorded action, newest
  first, filtered by who, what, which project and when, with a CSV export of
  exactly the filtered rows. The server decides what each entry shows:
  never comments, passwords, tokens or names typed at failed sign-ins.
*/
export default function AuditPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => Object.fromEntries(FILTERS.map((k) => [k, params.get(k) || ''])), [params]);
  const [options, setOptions] = useState(null);
  const [rows, setRows] = useState(null);
  const [next, setNext] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const qs = useCallback((extra = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, ...extra })) if (v) q.set(k, v);
    return q.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setError(null); setRows(null);
    try { const r = await get(`/api/admin/audit?${qs({ limit: '100' })}`); setRows(r.entries); setNext(r.next); } catch (e) { setError(e); }
  }, [qs]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { get('/api/admin/audit/actions').then(setOptions).catch(() => setOptions({ actions: [], users: [], projects: [] })); }, []);

  const set = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    if (k === 'category') n.delete('action');
    setParams(n, { replace: true });
  };
  const actions = options ? options.actions.filter((a) => !filters.category || a.action.startsWith(`${filters.category}.`)) : [];

  async function more() {
    setBusy('more');
    try { const r = await get(`/api/admin/audit?${qs({ limit: '100', before: next })}`); setRows((x) => [...x, ...r.entries]); setNext(r.next); } catch (e) { toast.error('Could not load more', e.message); }
    setBusy(null);
  }
  async function exportCsv() {
    setBusy('csv');
    try {
      const blob = await fetchBlob(`/api/admin/audit.csv?${qs()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `agastya-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success('Audit log exported', 'The export is itself recorded in the audit log.');
    } catch (e) { toast.error('Export failed', e.message); }
    setBusy(null);
  }
  const filtered = FILTERS.some((k) => filters[k]);

  return (
    <>
      <PageHeader eyebrow="Administration" title="Audit log"
        subtitle="Every recorded action, newest first. Comments, passwords, tokens and names typed at failed sign-ins are never shown or exported."
        actions={<Button icon="download" onClick={exportCsv} loading={busy === 'csv'}>Export CSV</Button>} />
      <Card className="overflow-hidden">
        <form className="grid gap-3 px-4 py-4 border-b border-line sm:grid-cols-2 lg:grid-cols-6" onSubmit={(e) => e.preventDefault()} aria-label="Filter the audit log">
          <Field label="User">
            {(p) => (
              <Select {...p} value={filters.user} onChange={(e) => set('user', e.target.value)}>
                <option value="">Anyone</option>
                {(options ? options.users : []).map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.username})</option>)}
              </Select>
            )}
          </Field>
          <Field label="Category">
            {(p) => (
              <Select {...p} value={filters.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">All</option>
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Action">
            {(p) => (
              <Select {...p} value={filters.action} onChange={(e) => set('action', e.target.value)}>
                <option value="">Any</option>
                {actions.map((a) => <option key={a.action} value={a.action}>{a.action} ({a.count})</option>)}
              </Select>
            )}
          </Field>
          <Field label="Project">
            {(p) => (
              <Select {...p} value={filters.project} onChange={(e) => set('project', e.target.value)}>
                <option value="">Any</option>
                {(options ? options.projects : []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="From (UTC)">{(p) => <Input {...p} type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />}</Field>
          <Field label="To (UTC)">{(p) => <Input {...p} type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />}</Field>
        </form>
        {filtered ? (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-line text-[12.5px] text-ink-3">
            <Icon name="search" size={14} />Filtered. The export contains the same rows.
            <Button size="sm" variant="ghost" onClick={() => setParams({}, { replace: true })}>Clear filters</Button>
          </div>
        ) : null}
        {error ? <ErrorState error={error} onRetry={load} /> : !rows ? <div className="p-5"><LoadingBlock rows={6} /></div> : !rows.length ? (
          <EmptyState icon="list" title="No matching entries" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" data-testid="audit-table">
              <caption className="sr-only">Audit log entries</caption>
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-wide text-ink-3 border-b border-line">
                  <th scope="col" className="font-medium px-4 py-2">When</th>
                  <th scope="col" className="font-medium px-3 py-2">Who</th>
                  <th scope="col" className="font-medium px-3 py-2">Action</th>
                  <th scope="col" className="font-medium px-3 py-2 hidden md:table-cell">Project</th>
                  <th scope="col" className="font-medium px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-b border-line align-top" data-testid="audit-row">
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-2 tabular">{fmtDateTime(e.at)}<span className="block font-mono text-[11px] text-ink-3">#{e.id}{e.ip ? ` · ${e.ip}` : ''}</span></td>
                    <td className="px-3 py-2.5">{e.actor ? <><span className="text-ink">{e.actor.name || e.actor.username}</span><Mono className="block text-[11.5px]">{e.actor.username}</Mono></> : <span className="text-ink-3">System or unknown</span>}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {e.action === 'admin.override' ? <Badge tone="accent" icon="shield">Override</Badge> : null}
                        {isFailureAction(e.action) ? <Badge tone="danger" icon="alert">Failed</Badge> : null}
                        <Mono className="text-[12px]">{e.action}</Mono>
                      </span>
                      <span className="block text-[12px] text-ink-3">{describeAction(e.action, e.details)}</span>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">{e.project ? <Link to={`/projects/${e.project.id}`} className="text-accent hover:underline">{e.project.name || e.project.id}</Link> : <span className="text-ink-3">—</span>}</td>
                    <td className="px-3 py-2.5 min-w-[220px] max-w-[420px]"><Details d={e.details} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {next ? <div className="p-4 text-center"><Button onClick={more} loading={busy === 'more'}>Load older entries</Button></div> : <p className="p-4 text-center text-[12px] text-ink-3">End of the log for these filters.</p>}
          </div>
        )}
      </Card>
    </>
  );
}
