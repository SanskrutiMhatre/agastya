export function Card({ className = '', children, as: Tag = 'section', ...rest }) {
  return <Tag className={`rounded-lg border border-line bg-surface shadow-card ${className}`} {...rest}>{children}</Tag>;
}

export function CardHeader({ title, subtitle, actions, id }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="text-[13px] text-ink-3 mt-0.5">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        {eyebrow ? <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 mb-1">{eyebrow}</p> : null}
        <h1 className="text-[22px] leading-tight font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="text-ink-3 mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

// A definition list for detail panels.
export function DetailList({ items }) {
  return (
    <dl className="divide-y divide-line">
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(120px,40%)_1fr] gap-3 py-2.5 text-[13px]">
          <dt className="text-ink-3">{k}</dt>
          <dd className="text-ink min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
