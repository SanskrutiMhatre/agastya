import Icon from '../Icon.jsx';

export function Spinner({ size = 18, className = '', label }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`animate-spin ${className}`} role={label ? 'status' : undefined}
      aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FullPageSpinner() {
  return (
    <div className="min-h-screen grid place-items-center text-ink-3">
      <Spinner size={28} label="Loading" />
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-md ${className}`} aria-hidden="true" />;
}

// Loading placeholder for a card or table body.
export function LoadingBlock({ rows = 4, label = 'Loading' }) {
  return (
    <div className="space-y-3 p-1" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={`h-9 ${i % 2 ? 'w-11/12' : 'w-full'}`} />)}
    </div>
  );
}

export function EmptyState({ icon = 'layers', title, children, action }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      <div className="grid place-items-center w-11 h-11 rounded-full bg-surface-3 text-ink-3 mb-3">
        <Icon name={icon} size={20} />
      </div>
      <p className="font-medium text-ink">{title}</p>
      {children ? <div className="mt-1 text-ink-3 max-w-sm">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'This could not be loaded' }) {
  return (
    <div role="alert" className="flex flex-col items-center text-center px-6 py-10">
      <div className="grid place-items-center w-11 h-11 rounded-full bg-danger-soft text-danger mb-3">
        <Icon name="alert" size={20} />
      </div>
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 text-ink-3 max-w-sm">{error && error.message ? error.message : 'Something went wrong.'}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-1.5 text-accent font-medium hover:underline">
          <Icon name="refresh" size={16} /> Try again
        </button>
      ) : null}
    </div>
  );
}

// Inline banner for form-level messages.
export function Alert({ tone = 'danger', title, children, className = '' }) {
  const tones = {
    danger: 'bg-danger-soft text-danger border-danger/25',
    warn: 'bg-warn-soft text-warn border-warn/30',
    ok: 'bg-ok-soft text-ok border-ok/25',
    info: 'bg-accent-soft text-accent-soft-ink border-accent/20',
  };
  const icon = { danger: 'alert', warn: 'alert', ok: 'checkCircle', info: 'info' }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex gap-2.5 rounded-md border px-3 py-2.5 text-[13px] ${tones[tone]} ${className}`}>
      <Icon name={icon} size={17} className="mt-px" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5' : ''}>{children}</div> : null}
      </div>
    </div>
  );
}

// A clearly labelled placeholder for functionality that arrives in a later phase.
export function PhaseBadge({ phase }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">
      Phase {phase}
    </span>
  );
}

export function PhasePlaceholder({ phase, title, children, compact = false }) {
  return (
    <div className={`rounded-lg border border-dashed border-line-strong bg-surface-2 ${compact ? 'px-4 py-4' : 'px-6 py-8'} text-center`}>
      <div className="flex justify-center mb-2"><PhaseBadge phase={phase} /></div>
      <p className="font-medium text-ink-2">{title}</p>
      {children ? <p className="mt-1 text-[13px] text-ink-3 max-w-md mx-auto">{children}</p> : null}
    </div>
  );
}
