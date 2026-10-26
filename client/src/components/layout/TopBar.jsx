import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../Icon.jsx';
import Popover from './Popover.jsx';
import { Avatar } from '../ui/Badge.jsx';
import { useAuth } from '../../auth.jsx';
import { useTheme } from '../../theme.js';
import { get, post } from '../../api.js';
import { ROLE_LABELS } from '../../nav.js';
import { fmtRelative } from '../../lib/format.js';
import { Spinner } from '../ui/States.jsx';
import ChangePasswordDialog from '../ChangePasswordDialog.jsx';

const iconBtn = 'h-9 w-9 grid place-items-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink';

function ThemeSwitch() {
  const [pref, setPref] = useTheme();
  const opts = [['light', 'sun', 'Light'], ['dark', 'moon', 'Dark'], ['system', 'monitor', 'System']];
  return (
    <div role="radiogroup" aria-label="Colour theme" className="hidden sm:flex items-center rounded-md border border-line p-0.5">
      {opts.map(([v, icon, label]) => (
        <button key={v} type="button" role="radio" aria-checked={pref === v} aria-label={label} title={label}
          onClick={() => setPref(v)}
          className={`h-7 w-7 grid place-items-center rounded ${pref === v ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink'}`}>
          <Icon name={icon} size={15} />
        </button>
      ))}
    </div>
  );
}

function Notifications() {
  const { me, refresh } = useAuth();
  const [items, setItems] = useState(null);
  const unread = me.unreadNotifications || 0;
  const load = useCallback(async () => {
    try { setItems((await get('/api/notifications')).notifications); } catch { setItems([]); }
  }, []);
  async function markAll() {
    await post('/api/notifications/read', {});
    await Promise.all([load(), refresh()]);
  }
  return (
    <Popover label="Notifications" width="w-80 sm:w-96" trigger={(p) => (
      <button {...p} type="button" className={`${iconBtn} relative`} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        onClick={(e) => { p.onClick(e); load(); }}>
        <Icon name="bell" size={19} />
        {unread ? <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brass ring-2 ring-surface" aria-hidden="true" /> : null}
      </button>
    )}>
      {() => (
        <div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="font-semibold">Notifications</p>
            {unread ? <button type="button" onClick={markAll} className="text-[13px] text-accent hover:underline">Mark all read</button> : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items == null ? <div className="p-6 grid place-items-center text-ink-3"><Spinner label="Loading notifications" /></div>
              : !items.length ? <p className="px-4 py-8 text-center text-ink-3">You are all caught up.</p>
                : (
                  <ul className="divide-y divide-line">
                    {items.map((n) => (
                      <li key={n.id} className={`px-4 py-3 ${n.read_at ? '' : 'bg-accent-soft/40'}`}>
                        <div className="flex items-start gap-2">
                          {!n.read_at ? <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" aria-label="Unread" /> : <span className="w-1.5 shrink-0" />}
                          <div className="min-w-0">
                            {n.link ? <Link to={n.link} className="font-medium text-ink hover:underline">{n.title}</Link> : <p className="font-medium text-ink">{n.title}</p>}
                            {n.body ? <p className="text-[13px] text-ink-3 mt-0.5">{n.body}</p> : null}
                            <p className="text-[11.5px] text-ink-3 mt-1">{fmtRelative(n.created_at)}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
          </div>
        </div>
      )}
    </Popover>
  );
}

function AccountMenu() {
  const { me, signOut } = useAuth();
  const nav = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
  const u = me.user;
  return (
    <>
      <Popover label="Account" width="w-64" trigger={(p) => (
        <button {...p} type="button" className="flex items-center gap-2 rounded-md pl-1 pr-2 py-1 hover:bg-surface-3" aria-label={`Account: ${u.fullName}`}>
          <Avatar name={u.fullName} size={30} />
          <span className="hidden md:block text-left leading-tight">
            <span className="block text-[13px] font-medium text-ink">{u.fullName}</span>
            <span className="block text-[11.5px] text-ink-3">{ROLE_LABELS[u.role]}</span>
          </span>
          <Icon name="chevronDown" size={15} className="text-ink-3 hidden md:block" />
        </button>
      )}>
        {({ close }) => (
          <div className="py-1">
            <div className="px-4 py-3 border-b border-line">
              <p className="font-medium">{u.fullName}</p>
              <p className="font-mono text-[12px] text-ink-3">{u.username}</p>
            </div>
            <button type="button" onClick={() => { close(); setPwOpen(true); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-surface-3">
              <Icon name="key" size={16} className="text-ink-3" />Change password
            </button>
            <button type="button" onClick={async () => { close(); await signOut(); nav('/signin', { replace: true }); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-surface-3">
              <Icon name="logout" size={16} className="text-ink-3" />Sign out
            </button>
          </div>
        )}
      </Popover>
      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  );
}

export default function TopBar({ onMenu }) {
  const { refresh } = useAuth();
  // Keep badges (notifications, queues) fresh without a socket.
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60000);
    return () => clearInterval(id);
  }, [refresh]);
  return (
    <header className="sticky top-0 z-30 h-14 flex items-center gap-2 border-b border-line bg-surface/90 backdrop-blur px-3 sm:px-5">
      <button type="button" onClick={onMenu} className={`${iconBtn} lg:hidden`} aria-label="Open navigation">
        <Icon name="menu" size={20} />
      </button>
      <div className="flex-1" />
      <ThemeSwitch />
      <Notifications />
      <div className="w-px h-6 bg-line mx-1" aria-hidden="true" />
      <AccountMenu />
    </header>
  );
}
