import { logoUrl } from "@/lib/logos";
import { APPLY_BOARDS, PORTALS, type Portal } from "@/lib/portals";

// Each pill gets its own pastel, cycling through the theme's tints
const TINTS = ["bg-lavender", "bg-sky", "bg-mint", "bg-butter", "bg-peach", "bg-cyan"];

function PortalList({ items, tintOffset = 0 }: { items: Portal[]; tintOffset?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5">
      {items.map((p, i) => (
        <li key={p.url} className="pop min-w-0">
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${p.name}: ${p.note}`}
            className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 ring-1 ring-black/5 transition-shadow hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark ${TINTS[(i + tintOffset) % TINTS.length]}`}
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

const GROUPS = [
  { id: "portals", icon: "🧭", title: "Job portals", items: PORTALS },
  { id: "apply-boards", icon: "⚡", title: "Apply directly", items: APPLY_BOARDS },
];

// Desktop (lg): heading + pill grid per group; the layout puts them in the sidebar's scrolling area
export function PortalSection() {
  return (
    <>
      {GROUPS.map((g, gi) => (
        <section key={g.id} aria-labelledby={`${g.id}-heading`}>
          <h2 id={`${g.id}-heading`} className="flex items-center gap-1.5 px-1 pb-3 text-xs font-bold uppercase tracking-wider text-side-muted">
            <span aria-hidden="true">{g.icon}</span> {g.title}
          </h2>
          <PortalList items={g.items} tintOffset={gi * 3} />
        </section>
      ))}
    </>
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
        {/* Same compass as the sidebar's "Job portals" heading */}
        <span aria-hidden="true" className="grid size-5 place-items-center text-lg leading-none">🧭</span>
        <span className="sr-only">Job portals</span>
      </summary>
      <div className="absolute inset-x-0 top-full scroll-quiet max-h-[70vh] overflow-y-auto border-b border-rule bg-surface p-2 shadow-lift md:inset-x-auto md:left-full md:top-0 md:ml-3 md:w-80 md:rounded-2xl md:border">
        {GROUPS.map((g, gi) => (
          <div key={g.id}>
            <p className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">{g.title}</p>
            <PortalList items={g.items} tintOffset={gi * 3} />
          </div>
        ))}
      </div>
    </details>
  );
}
