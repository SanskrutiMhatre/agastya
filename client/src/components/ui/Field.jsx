import { forwardRef, useId, useState } from 'react';
import Icon from '../Icon.jsx';

const CONTROL = `w-full rounded-md border bg-surface text-ink placeholder:text-ink-3 transition-colors
  border-line-strong hover:border-ink-3 focus:border-accent focus:outline-none focus-visible:outline-2
  focus-visible:outline-offset-0 disabled:bg-surface-3 disabled:text-ink-3 aria-[invalid=true]:border-danger`;

// Label + control + hint/error, wired with ids so screen readers announce them.
export function Field({ label, hint, error, children, required, className = '', id: given }) {
  const auto = useId();
  const id = given || auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink-2 mb-1.5">
        {label}{required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && !error ? <p id={hintId} className="mt-1.5 text-[12px] text-ink-3">{hint}</p> : null}
      {error ? <p id={errId} className="mt-1.5 text-[12px] text-danger flex items-center gap-1"><Icon name="alert" size={13} />{error}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`${CONTROL} h-9 px-3 ${className}`} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} className={`${CONTROL} px-3 py-2 min-h-20 ${className}`} {...props} />;
});

export const Select = forwardRef(function Select({ className = '', children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={`${CONTROL} h-9 pl-3 pr-8 appearance-none ${className}`} {...props}>{children}</select>
      <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
    </div>
  );
});

export const PasswordInput = forwardRef(function PasswordInput({ className = '', ...props }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} type={show ? 'text' : 'password'} className={`${CONTROL} h-9 pl-3 pr-10 ${className}`} {...props} />
      <button
        type="button" onClick={() => setShow((s) => !s)}
        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-8 grid place-items-center rounded text-ink-3 hover:text-ink"
        aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
      >
        <Icon name={show ? 'eyeOff' : 'eye'} size={17} />
      </button>
    </div>
  );
});

export function SearchInput({ value, onChange, placeholder = 'Search', label = 'Search', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Icon name="search" size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
        className={`${CONTROL} h-9 pl-8 pr-3`}
      />
    </div>
  );
}

/*
  Live password checklist. Mirrors the server policy for guidance only; the
  server decides.
*/
export function PasswordChecklist({ password, confirm, username }) {
  const u = String(username || '').toLowerCase();
  const tempShape = u && new RegExp(`^${u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@\\d{4}$`, 'i').test(password);
  const items = [
    { ok: password.length >= 8 && password.length <= 128, text: '8 to 128 characters' },
    { ok: !!password && !tempShape, text: 'Not based on your temporary password' },
    { ok: !!password && password === confirm, text: 'Both entries match' },
  ];
  return (
    <ul className="space-y-1 text-[12px]" aria-label="Password requirements">
      {items.map((i) => (
        <li key={i.text} className={`flex items-center gap-1.5 ${i.ok ? 'text-ok' : 'text-ink-3'}`}>
          <Icon name={i.ok ? 'checkCircle' : 'clock'} size={14} />
          <span>{i.text}</span><span className="sr-only">{i.ok ? ' (met)' : ' (not met)'}</span>
        </li>
      ))}
    </ul>
  );
}
