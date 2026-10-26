import { useEffect, useRef } from 'react';
import { Spinner } from './ui/States.jsx';
import Icon from './Icon.jsx';

/*
  Live build progress: the lines the engine reports while it runs, as they
  arrive over the project WebSocket ("Mapping S1000D to JSS book…",
  "Generating PDF (FOP)…"). Also shows builds started by someone else.
*/
export default function BuildLog({ log, title = 'Build progress', className = '' }) {
  const box = useRef(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [log]);
  if (!log) return null;
  const running = log.phase === 'running';
  const failed = log.phase === 'error';
  return (
    <div className={`rounded-md border ${failed ? 'border-danger/30' : 'border-line'} bg-surface-2 ${className}`} aria-live="polite">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line text-[12.5px]">
        {running ? <Spinner size={14} /> : <Icon name={failed ? 'alert' : 'checkCircle'} size={15} className={failed ? 'text-danger' : 'text-ok'} />}
        <span className="font-medium text-ink-2">{title}</span>
        <span className="text-ink-3 truncate">{running ? 'running' : failed ? 'failed' : 'finished'}{log.by ? ` · ${log.by}` : ''}</span>
      </div>
      <ol ref={box} data-testid="build-log" className="max-h-40 overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-5 text-ink-2 space-y-0.5">
        {log.lines.filter(Boolean).map((l, i) => <li key={i} className="break-words">{l}</li>)}
      </ol>
    </div>
  );
}
