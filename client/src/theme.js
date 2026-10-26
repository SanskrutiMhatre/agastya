import { useEffect, useState } from 'react';

// Light / dark / system. A display preference only, kept per browser.
const KEY = 'agastya-theme';

function apply(pref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function useTheme() {
  const [pref, setPref] = useState(() => {
    try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; }
  });
  useEffect(() => {
    apply(pref);
    try { localStorage.setItem(KEY, pref); } catch { /* storage blocked */ }
    if (pref !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => apply('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pref]);
  return [pref, setPref];
}
