import Icon from '../Icon.jsx';
import { ROLE_LABELS } from '../../nav.js';
import { initials } from '../../lib/format.js';

const TONES = {
  neutral: 'bg-surface-3 text-ink-2',
  accent: 'bg-accent-soft text-accent-soft-ink',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({ tone = 'neutral', icon, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap ${TONES[tone]} ${className}`}>
      {icon ? <Icon name={icon} size={13} /> : null}{children}
    </span>
  );
}

const ROLE_TONE = { software_admin: 'accent', project_manager: 'neutral', author: 'neutral' };
const ROLE_ICON = { software_admin: 'shield', project_manager: 'users', author: 'edit' };

export function RoleBadge({ role }) {
  return <Badge tone={ROLE_TONE[role]} icon={ROLE_ICON[role]}>{ROLE_LABELS[role] || role}</Badge>;
}

// Status always pairs colour with an icon and a word (never colour alone).
const STATUS = {
  active: { tone: 'ok', icon: 'checkCircle', label: 'Active' },
  pending: { tone: 'warn', icon: 'clock', label: 'Setup pending' },
  disabled: { tone: 'danger', icon: 'ban', label: 'Disabled' },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.active;
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
}

export function Avatar({ name, size = 32, className = '' }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-full bg-accent-soft text-accent-soft-ink font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

// A project's owner: name with their role, since an owner may be an Author or a Project Manager.
export function OwnerTag({ owner, size = 22 }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <Avatar name={owner.fullName} size={size} />
      <span className="min-w-0 truncate">{owner.fullName}</span>
      <span className="text-[11.5px] text-ink-3 whitespace-nowrap">{owner.role === 'author' ? 'Author' : 'Project Manager'}</span>
    </span>
  );
}

export function Mono({ children, className = '' }) {
  return <span className={`font-mono text-[12.5px] text-ink-2 ${className}`}>{children}</span>;
}
