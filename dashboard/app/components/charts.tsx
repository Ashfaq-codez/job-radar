// Small single-series charts built from plain HTML: one hue, recessive axes, hover tooltips.

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-white opacity-0 shadow-lift transition-opacity group-hover:opacity-100">
      {children}
    </span>
  );
}

export function ColumnChart({
  data,
  label,
  tip,
  color = () => "linear-gradient(180deg, #10b981, #4d7c0f)",
  height = 140,
}: {
  data: { key: string; n: number }[];
  label: (key: string, i: number) => string | null; // axis label, null to skip
  tip: (d: { key: string; n: number }) => string;
  color?: (key: string) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <figure>
      <div className="relative flex items-end gap-[2px] border-b border-rule" style={{ height }}>
        {data.map((d) => (
          // The whole column is the hover target, not just the bar
          <div key={d.key} className="group relative flex h-full flex-1 items-end">
            <Tip>{tip(d)}</Tip>
            <div
              className="w-full rounded-t-[6px] transition-opacity group-hover:opacity-75"
              style={{ height: d.n === 0 ? 0 : `max(3px, ${(d.n / max) * 100}%)`, background: color(d.key) }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[10px] text-faint">
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center tabular-nums">{label(d.key, i)}</span>
        ))}
      </div>
    </figure>
  );
}

export function BarList({ data, tip }: { data: { label: string; n: number; href?: string }[]; tip: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <ul className="space-y-1">
      {data.map((d) => {
        const row = (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-lavender to-sky transition-opacity group-hover:opacity-80"
              style={{ width: `${(d.n / max) * 100}%` }}
            />
            <span className="relative truncate">{d.label}</span>
            <span className="relative ml-auto pl-3 tabular-nums text-muted">{d.n}</span>
          </>
        );
        const cls = "group relative flex items-center rounded-md px-2.5 py-1.5 text-sm";
        return (
          <li key={d.label} title={tip(d.n)}>
            {d.href ? <a href={d.href} className={cls}>{row}</a> : <div className={cls}>{row}</div>}
          </li>
        );
      })}
    </ul>
  );
}
