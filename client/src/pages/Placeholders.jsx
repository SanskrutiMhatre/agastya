import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card.jsx';
import Icon from '../components/Icon.jsx';

// Every planned screen has arrived (Phase 4 replaced the last placeholder, the audit log); only the 404 page is left here.
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
