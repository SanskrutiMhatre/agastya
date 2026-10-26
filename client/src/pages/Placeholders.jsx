import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../components/ui/Card.jsx';
import { PhaseBadge } from '../components/ui/States.jsx';
import Icon from '../components/Icon.jsx';

/*
  Clearly labelled placeholders for later-phase screens. They describe what
  will be here and perform no action.
*/
function Placeholder({ phase, eyebrow, title, summary, features }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={summary} actions={<PhaseBadge phase={phase} />} />
      <Card className="border-dashed">
        <div className="px-6 py-8 grid gap-8 md:grid-cols-[1fr_1.2fr] items-start">
          <div>
            <div className="grid place-items-center h-12 w-12 rounded-lg bg-surface-3 text-ink-3 mb-4"><Icon name="layers" size={22} /></div>
            <p className="font-semibold text-ink">Not available yet</p>
            <p className="mt-1 text-ink-3">This screen is part of Phase {phase}. Nothing here can change data.</p>
            <Link to="/" className="mt-4 inline-flex items-center gap-1.5 text-accent font-medium hover:underline"><Icon name="arrowLeft" size={15} />Back to dashboard</Link>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 mb-2">Planned</p>
            <ul className="space-y-2">
              {features.map((f) => (
                <li key={f} className="flex gap-2 text-ink-2"><Icon name="chevronRight" size={15} className="mt-0.5 text-ink-3" />{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </>
  );
}

export const DataModulesPlaceholder = () => (
  <Placeholder phase={2} eyebrow="Authoring" title="Data modules" summary="Data module editor and CSDB manager."
    features={['Create data modules from S1000D shells with the DMC stamped into the XML', 'SNS tree, search and soft delete', 'Structured schema-aware editor with an XML panel', 'XSD validation per S1000D issue and BREX checking', 'Save with revision-based conflict detection']} />
);

export const AuditPlaceholder = () => (
  <Placeholder phase={4} eyebrow="Administration" title="Audit log" summary="Organisation-wide audit trail."
    features={['Filter by actor, action, project and date', 'Export', 'Admin override events with their written reasons']} />
);

export function NotFound() {
  return (
    <Card>
      <div className="px-6 py-14 text-center">
        <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-3">404</p>
        <h1 className="mt-2 text-[20px] font-semibold">Page not found</h1>
        <p className="mt-1 text-ink-3">The page does not exist or is not available to your role.</p>
        <Link to="/" className="mt-5 inline-flex items-center gap-1.5 text-accent font-medium hover:underline"><Icon name="arrowLeft" size={15} />Back to dashboard</Link>
      </div>
    </Card>
  );
}
