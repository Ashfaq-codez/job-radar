import Link from "next/link";

// 1 … 4 5 [6] 7 8 … 20: always the ends, plus two pages either side of the current one
function pageList(current: number, total: number): (number | "gap")[] {
  const pages = new Set([1, total]);
  for (let p = current - 2; p <= current + 2; p++) if (p >= 1 && p <= total) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev === 2) out.push(prev + 1); // fill a single hole instead of showing "…"
    else if (prev !== undefined && p - prev > 2) out.push("gap");
    out.push(p);
  });
  return out;
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  if (pages <= 1) return null;
  const cell = "grid h-9 min-w-9 place-items-center rounded-xl px-3 text-sm font-medium tabular-nums transition-colors";
  const idle = `${cell} border border-rule bg-surface text-muted hover:bg-subtle hover:text-ink`;
  const off = `${cell} border border-rule bg-surface text-faint opacity-50`;

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? <Link href={href(page - 1)} className={idle} aria-label="Previous page">←</Link> : <span className={off} aria-hidden="true">←</span>}
      {pageList(page, pages).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-faint" aria-hidden="true">…</span>
        ) : p === page ? (
          <span key={p} aria-current="page" className={`${cell} btn-gradient`}>{p}</span>
        ) : (
          <Link key={p} href={href(p)} className={idle} aria-label={`Page ${p}`}>{p}</Link>
        ),
      )}
      {page < pages ? <Link href={href(page + 1)} className={idle} aria-label="Next page">→</Link> : <span className={off} aria-hidden="true">→</span>}
    </nav>
  );
}
