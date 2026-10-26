import { useEffect, useId, useRef, useState } from 'react';

/*
  Disclosure popover for top-bar menus. Escape and outside clicks close it
  and return focus to the trigger.
*/
export default function Popover({ trigger, children, align = 'right', width = 'w-72', label }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const btn = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btn.current && btn.current.focus(); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={box} className="relative">
      {trigger({ ref: btn, 'aria-expanded': open, 'aria-controls': id, 'aria-haspopup': 'true', onClick: () => setOpen((o) => !o) })}
      {open ? (
        <div id={id} role="region" aria-label={label}
          className={`absolute z-40 mt-2 ${align === 'right' ? 'right-0' : 'left-0'} ${width} rounded-lg border border-line bg-surface shadow-pop`}>
          {children({ close: () => setOpen(false) })}
        </div>
      ) : null}
    </div>
  );
}
