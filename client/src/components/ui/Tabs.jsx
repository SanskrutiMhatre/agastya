import { useRef } from 'react';

// Accessible tabs: arrow keys move between tabs, the panel is labelled by its tab.
export default function Tabs({ tabs, value, onChange, idBase = 'tabs' }) {
  const refs = useRef([]);
  function onKey(e, i) {
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    if (n != null) { e.preventDefault(); onChange(tabs[n].value); refs.current[n] && refs.current[n].focus(); }
  }
  return (
    <div role="tablist" className="flex gap-1 border-b border-line">
      {tabs.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value} ref={(el) => { refs.current[i] = el; }} type="button" role="tab"
            id={`${idBase}-tab-${t.value}`} aria-controls={`${idBase}-panel-${t.value}`}
            aria-selected={active} tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)} onKeyDown={(e) => onKey(e, i)}
            className={`relative -mb-px inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors
              ${active ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink'}`}
          >
            {t.label}
            {t.count ? <span className="rounded-full bg-warn-soft text-warn px-1.5 text-[11px] font-semibold tabular">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ value, active, idBase = 'tabs', children }) {
  if (value !== active) return null;
  return <div role="tabpanel" id={`${idBase}-panel-${value}`} aria-labelledby={`${idBase}-tab-${value}`} className="pt-4">{children}</div>;
}
