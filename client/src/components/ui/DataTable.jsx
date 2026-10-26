import { useMemo, useState } from 'react';
import Icon from '../Icon.jsx';

/*
  Sortable table. columns: [{ key, header, render(row), sortValue(row)?,
  align?, className?, hideBelow? ('sm'|'md'|'lg') }]. Sorting is keyboard
  operable (buttons in headers) and announced through aria-sort.
*/
const HIDE = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };

export default function DataTable({ columns, rows, rowKey = (r) => r.id, initialSort, empty, caption }) {
  const [sort, setSort] = useState(initialSort || null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col || !col.sortValue) return rows;
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue(a);
      const vb = col.sortValue(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === 'string' ? va.localeCompare(vb, undefined, { sensitivity: 'base' }) : va - vb) * dir;
    });
  }, [rows, sort, columns]);

  const toggle = (key) => setSort((s) => (s && s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px] border-collapse">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-y border-line bg-surface-2">
            {columns.map((c) => {
              const active = sort && sort.key === c.key;
              const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : c.sortValue ? 'none' : undefined;
              return (
                <th key={c.key} scope="col" aria-sort={ariaSort}
                  className={`px-4 py-2 font-medium text-ink-3 text-[12px] uppercase tracking-wide whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''} ${c.hideBelow ? HIDE[c.hideBelow] : ''}`}>
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggle(c.key)} className={`inline-flex items-center gap-1 rounded hover:text-ink ${active ? 'text-ink' : ''}`}>
                      {c.header}
                      <Icon name={active && sort.dir === 'desc' ? 'chevronDown' : 'chevronUp'} size={13} className={active ? '' : 'opacity-30'} />
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={rowKey(r)} className="border-b border-line last:border-b-0 hover:bg-surface-2">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-2.5 align-middle ${c.align === 'right' ? 'text-right tabular' : ''} ${c.hideBelow ? HIDE[c.hideBelow] : ''} ${c.className || ''}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? empty : null}
    </div>
  );
}
