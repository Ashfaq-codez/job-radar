import { logoUrl } from "@/lib/logos";
import { PORTALS } from "@/lib/portals";

// Each pill gets its own pastel, cycling through the theme's tints
const TINTS = ["bg-lavender", "bg-sky", "bg-mint", "bg-butter", "bg-peach", "bg-cyan"];

function PortalList() {
  return (
    <ul className="grid grid-cols-2 gap-2.5">
      {PORTALS.map((p, i) => (
        <li key={p.url} className="pop min-w-0">
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${p.name}: ${p.note}`}
            className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 ring-1 ring-black/5 transition-shadow hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark ${TINTS[i % TINTS.length]}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon */}
            <img src={logoUrl(p.logoDomain ?? new URL(p.url).hostname)} alt="" className="size-6 shrink-0 rounded-full bg-surface p-1 shadow-card" />
            <span className="truncate text-xs font-medium text-ink">{p.name}</span>
            <span className="sr-only">, {p.note} (opens in new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// Desktop (lg): heading + pill grid; the layout puts it in the sidebar's scrolling area
export function PortalSection() {
  return (
    <section aria-labelledby="portals-heading">
      <h2 id="portals-heading" className="flex items-center gap-1.5 px-1 pb-3 text-xs font-bold uppercase tracking-wider text-side-muted">
        <span aria-hidden="true">🧭</span> Job portals
      </h2>
      <PortalList />
    </section>
  );
}

// Mobile top bar and tablet icon rail: a native disclosure, no client JS
export function PortalDisclosure() {
  return (
    <details className="group/portals md:relative lg:hidden">
      <summary
        title="Job portals"
        className="flex cursor-pointer list-none items-center justify-center rounded-xl p-2.5 text-side-muted transition-colors hover:bg-white/10 hover:text-side-ink focus-visible:outline-2 focus-visible:outline-spark group-open/portals:bg-white group-open/portals:text-accent [&::-webkit-details-marker]:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0">
          <circle cx="10" cy="10" r="7" />
          <path d="M3 10h14M10 3c2 2.2 2.8 4.5 2.8 7s-.8 4.8-2.8 7c-2-2.2-2.8-4.5-2.8-7S8 5.2 10 3z" />
        </svg>
        <span className="sr-only">Job portals</span>
      </summary>
      <div className="absolute inset-x-0 top-full scroll-quiet max-h-[70vh] overflow-y-auto border-b border-rule bg-surface p-2 shadow-lift md:inset-x-auto md:left-full md:top-0 md:ml-3 md:w-80 md:rounded-2xl md:border">
        <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-faint">Job portals</p>
        <PortalList />
      </div>
    </details>
  );
}
