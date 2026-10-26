import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon from '../Icon.jsx';

const ToastContext = createContext(null);

const TONE = {
  success: { icon: 'checkCircle', cls: 'text-ok' },
  error: { icon: 'alert', cls: 'text-danger' },
  info: { icon: 'info', cls: 'text-accent' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((tone, title, body) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, tone, title, body }]);
    setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 5000);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (title, body) => push('success', title, body),
    error: (title, body) => push('error', title, body),
    info: (title, body) => push('info', title, body),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" aria-relevant="additions" className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 sm:w-96 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex gap-3 rounded-lg border border-line bg-surface shadow-pop px-4 py-3 [animation:toast-in_160ms_ease-out]">
            <Icon name={TONE[t.tone].icon} size={18} className={`mt-0.5 ${TONE[t.tone].cls}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{t.title}</p>
              {t.body ? <p className="text-[13px] text-ink-3 mt-0.5">{t.body}</p> : null}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="h-6 w-6 grid place-items-center rounded text-ink-3 hover:text-ink">
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
