import { useCallback, useEffect, useRef, useState } from 'react';
import Button from './ui/Button.jsx';
import { ConfirmDialog } from './ui/Dialog.jsx';
import { useToast } from './ui/Toast.jsx';
import Icon from './Icon.jsx';
import OverrideDialog from './OverrideDialog.jsx';
import { post, setOverrideSession } from '../api.js';
import { fmtRelative } from '../lib/format.js';

const IDLE_MS = 30 * 60 * 1000;
const PEOPLE = "the project's owner and Authors, and the manager of any pending request";

/*
  The administrator's editing session on one document (decisions.md V3):
  read-only until "Edit as administrator", which asks for a reason. The
  session then stays open while the administrator works on the document;
  every save is recorded with that reason. It ends after 30 minutes without a
  save, when the administrator leaves the document (this component unmounts,
  or the page is closed) or stops; a new reason is then needed. The server
  enforces the same rules: this only keeps the page in step.
*/
export function useOverrideSession({ projectId, docKey, label, enabled }) {
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [asking, setAsking] = useState(false);
  const [ended, setEnded] = useState(null);
  const [stale, setStale] = useState(null); // { lock, resolve }
  const idle = useRef(null);
  const live = useRef(null);

  const finish = useCallback((why) => {
    const s = live.current;
    live.current = null;
    clearTimeout(idle.current);
    setOverrideSession(null);
    setSession(null);
    if (s && why !== 'server') post(`/api/override-sessions/${s.id}/end`).catch(() => { /* already ended */ });
    if (why === 'idle' || why === 'server') setEnded(why);
  }, []);

  const armIdle = useCallback(() => {
    clearTimeout(idle.current);
    idle.current = setTimeout(() => { finish('idle'); toast.info('Editing as administrator ended', 'Thirty minutes without a save. Start again with a new reason to continue.'); }, IDLE_MS);
  }, [finish, toast]);

  useEffect(() => {
    if (!session) return undefined;
    live.current = session;
    setOverrideSession({
      id: session.id, projectId,
      onUsed: armIdle,
      onEnded: () => { finish('server'); toast.info('Editing as administrator ended', 'The session expired. Start again with a new reason.'); },
      onStale: (body) => new Promise((resolve) => setStale({ lock: body.lock, message: body.error, resolve })),
    });
    armIdle();
    // Closing the page ends the session too.
    const onHide = () => { if (live.current) navigator.sendBeacon(`/api/override-sessions/${live.current.id}/end`, new Blob(['{}'], { type: 'application/json' })); };
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); };
  }, [session, projectId, armIdle, finish, toast]);

  // Leaving the document (unmount, or another document) ends the session.
  useEffect(() => () => finish('left'), [docKey, finish]);

  async function start(reason) {
    const r = await post(`/api/projects/${projectId}/override-sessions`, { key: docKey, reason });
    setEnded(null);
    setSession(r.session);
    setAsking(false);
    toast.success('Editing as administrator', 'Each save is recorded with your reason.');
  }

  const bar = !enabled ? null : (
    <>
      {session ? (
        <div role="status" data-testid="override-bar" className="flex flex-wrap items-start gap-3 rounded-md border border-accent/30 bg-accent-soft px-3 py-2.5 text-[13px] text-ink">
          <Icon name="shield" size={17} className="mt-px text-accent" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Editing {label} as administrator (override)</p>
            <p className="mt-0.5 text-ink-2">Reason: <span className="text-ink">“{session.reason}”</span>. Every save is recorded in the audit log and the people involved are told.
              Ends after 30 minutes without a save or when you leave; started {fmtRelative(session.startedAt)}.</p>
          </div>
          <Button size="sm" variant="ghost" icon="x" onClick={() => finish('left')}>Stop editing</Button>
        </div>
      ) : (
        <div data-testid="override-offer" className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface-2 px-3 py-2.5 text-[13px]">
          <Icon name="shield" size={17} className="text-ink-3" />
          <p className="min-w-0 flex-1 text-ink-2">
            {ended ? 'Your editing session ended. ' : ''}Read-only for the administrator. You can edit {label} as an override, with a written reason.
          </p>
          <Button size="sm" icon="edit" onClick={() => setAsking(true)}>Edit as administrator</Button>
        </div>
      )}
      <OverrideDialog open={asking} onClose={() => setAsking(false)} title={`Edit ${label} as administrator`} confirmLabel="Start editing"
        description="Your edits go through the normal save path. One reason covers this editing session; each save is recorded separately."
        people={PEOPLE} onSubmit={start} />
      <ConfirmDialog open={!!stale} title="This save makes a pending request out of date" confirmLabel="Save and make it out of date" tone="danger"
        onClose={() => { if (stale) stale.resolve(false); setStale(null); }}
        onConfirm={async () => { stale.resolve(true); setStale(null); }}>
        <p>{stale ? stale.message : ''}</p>
        <p className="text-[13px]">They are told with your reason.</p>
      </ConfirmDialog>
    </>
  );

  return { active: !!session, session, bar };
}
