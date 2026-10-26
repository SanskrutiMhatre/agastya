import { useEffect, useId, useRef, useState } from 'react';

/*
  Single-series column chart, built to the dataviz mark specs: columns at
  most 24px wide with a 4px rounded data end and a square baseline, hairline
  solid gridlines, clean rounded y ticks, one hue (--series-1, selected per
  theme). A hover/focus tooltip and a table view carry exact values, so
  nothing depends on reading the bars alone. Single series: no legend; the
  card title names what is plotted.
*/
function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export default function ColumnChart({ data, height = 180, valueLabel = 'value', formatLabel = (d) => d.label, tooltip }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!wrap.current) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max].filter((t) => Number.isInteger(t));
  const pad = { l: 32, r: 8, t: 10, b: 24 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const band = w / data.length;
  const bw = Math.min(24, band * 0.62);
  const y = (v) => pad.t + h - (v / max) * h;
  const labelEvery = band < 34 ? Math.ceil(34 / band) : 1;

  // Column path: 4px rounded top corners, square at the baseline.
  const col = (x, top) => {
    const bh = pad.t + h - top;
    if (bh <= 0) return '';
    const r = Math.min(4, bh, bw / 2);
    return `M${x},${pad.t + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${pad.t + h}Z`;
  };

  return (
    <div>
      <div className="flex justify-end -mt-1 mb-2">
        <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}
          className="text-[12px] text-ink-3 hover:text-ink inline-flex items-center gap-1 rounded px-1.5 py-0.5">
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {asTable ? (
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-[13px]">
            <thead><tr className="text-ink-3 text-left"><th className="py-1 font-medium">Day</th><th className="py-1 font-medium text-right">{valueLabel}</th></tr></thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-t border-line"><td className="py-1">{formatLabel(d)}</td><td className="py-1 text-right tabular">{d.value}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrap} className="relative">
          <svg width={width} height={height} role="img" aria-labelledby={titleId} className="block max-w-full">
            <title id={titleId}>{`${valueLabel} per day, ${data.length} days`}</title>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
                <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ink-3)" className="tabular">{t}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = pad.l + i * band + (band - bw) / 2;
              const active = hover === i;
              return (
                <g key={d.key}
                  tabIndex={0}
                  aria-label={`${formatLabel(d)}: ${d.value} ${valueLabel}`}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                  className="outline-none"
                >
                  {/* Hit target spans the whole band, larger than the mark. */}
                  <rect x={pad.l + i * band} y={pad.t} width={band} height={h} fill="transparent" />
                  {active ? <rect x={pad.l + i * band + 1} y={pad.t} width={band - 2} height={h} fill="var(--surface-3)" rx="3" /> : null}
                  <path d={col(x, y(d.value))} fill="var(--series-1)" opacity={hover == null || active ? 1 : 0.55} />
                  {i % labelEvery === 0 || i === data.length - 1 ? (
                    <text x={x + bw / 2} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{d.short || d.label}</text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {hover != null ? (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-line bg-surface shadow-pop px-3 py-2 text-[12px] whitespace-nowrap"
              style={{
                left: Math.min(Math.max(pad.l + hover * band + band / 2, 70), width - 70),
                top: Math.max(0, y(data[hover].value) - 8),
                transform: 'translate(-50%, -100%)',
              }}
            >
              <p className="font-medium text-ink">{formatLabel(data[hover])}</p>
              {tooltip ? tooltip(data[hover]) : <p className="text-ink-2 tabular">{data[hover].value} {valueLabel}</p>}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
