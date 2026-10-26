import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import { PhaseBadge, Skeleton } from './States.jsx';
import { fmtNumber } from '../../lib/format.js';

/*
  Stat tile: label, value, optional context line. A tile for a later phase
  shows a labelled placeholder instead of a misleading zero.
*/
export default function StatTile({ label, value, hint, icon, to, phase, loading, tone, className = '' }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-ink-3">{label}</p>
        {icon ? (
          <span className={`grid place-items-center h-8 w-8 rounded-md ${tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-surface-3 text-ink-2'}`}>
            <Icon name={icon} size={17} />
          </span>
        ) : null}
      </div>
      <div className="mt-2 min-h-9">
        {loading ? <Skeleton className="h-8 w-16" />
          : phase ? <div className="pt-1.5"><PhaseBadge phase={phase} /></div>
            : <p className="text-[28px] leading-none font-semibold text-ink">{fmtNumber(value)}</p>}
      </div>
      {hint ? <p className="mt-2 text-[12px] text-ink-3">{hint}</p> : null}
    </>
  );
  const cls = `block rounded-lg border border-line bg-surface shadow-card px-4 py-4 ${className}`;
  if (to && !phase) {
    return <Link to={to} className={`${cls} hover:border-line-strong transition-colors`}>{body}</Link>;
  }
  return <div className={cls}>{body}</div>;
}
