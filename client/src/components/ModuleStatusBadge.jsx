import { Badge } from './ui/Badge.jsx';

// A data module's status (decisions.md M3); it changes only through the approval flow.
export function ModuleStatusBadge({ status }) {
  const s = { draft: ['Draft', 'neutral'], in_review: ['In review', 'warn'], approved: ['Approved', 'ok'], deleted: ['Deleted', 'danger'] }[status] || [status, 'neutral'];
  return <Badge tone={s[1]}>{s[0]}</Badge>;
}
