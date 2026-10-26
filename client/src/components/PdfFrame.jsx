import Icon from './Icon.jsx';

/*
  A PDF shown in the page. The server allows these responses alone to be
  framed by the same origin; `version` busts the cache after a rebuild.
*/
export default function PdfFrame({ src, version, title, height = '70vh', onClose }) {
  if (!src) return null;
  const url = `${src}${src.includes('?') ? '&' : '?'}v=${version || 0}`;
  return (
    <div className="rounded-md border border-line overflow-hidden bg-surface-2">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line text-[12.5px] text-ink-2">
        <span className="font-medium truncate">{title}</span>
        <span className="flex items-center gap-3">
          <a href={url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-accent hover:underline"><Icon name="eye" size={14} />Open in a new tab</a>
          {onClose ? <button type="button" onClick={onClose} className="text-ink-3 hover:text-ink" aria-label="Close the PDF viewer"><Icon name="x" size={16} /></button> : null}
        </span>
      </div>
      <iframe title={title} src={url} className="block w-full bg-white" style={{ height }} />
    </div>
  );
}
