import { Badge } from './ui/Badge.jsx';
import Icon from './Icon.jsx';
import { fmtRelative } from '../lib/format.js';

/*
  The content lock (decisions.md L1): while a publication request is pending,
  its publication module, data modules and other frozen sources are
  read-only for every Author on the project.
*/
export function LockBanner({ lock, what = 'This', className = '' }) {
  if (!lock) return null;
  return (
    <div role="status" data-testid="lock-banner" className={`flex gap-2.5 rounded-md border border-warn/30 bg-warn-soft px-3 py-2.5 text-[13px] text-warn ${className}`}>
      <Icon name="lock" size={17} className="mt-px" />
      <div className="min-w-0">
        <p className="font-semibold">Locked: pending approval</p>
        <p className="mt-0.5">
          {what} is part of the publication {lock.submittedBy} submitted to {lock.manager} {fmtRelative(lock.submittedAt)}, and is read-only
          until the request is withdrawn, rejected or sent back with changes requested.
        </p>
      </div>
    </div>
  );
}

export const LockedBadge = () => <Badge tone="warn" icon="lock">Locked</Badge>;
