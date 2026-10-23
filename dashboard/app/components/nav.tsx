"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  "/": <path d="M3.5 9.5 10 4l6.5 5.5V16a1 1 0 0 1-1 1h-3v-4.5h-5V17h-3a1 1 0 0 1-1-1z" />,
  "/jobs": <path d="M3 7.5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5zM7.5 6V4.5h5V6M3 10.5h14" />,
  "/applied": <path d="M3.5 4h3.5v12H3.5zM8.25 8h3.5v8h-3.5zM13 11h3.5v5H13z" />,
  "/companies": <path d="M4 17V4.5h7V17M11 8.5h5V17M2.5 17h15M6.5 7.5h2M6.5 10.5h2M6.5 13.5h2M13.5 11.5h0M13.5 14h0" />,
};

// Each section gets its own pastel chip so the nav reads at a glance
const LINKS = [
  { href: "/", label: "Overview", chip: "bg-lavender text-accent" },
  { href: "/jobs", label: "Jobs", chip: "bg-sky text-applied" },
  { href: "/applied", label: "Applications", chip: "bg-mint text-offer" },
  { href: "/companies", label: "Companies", chip: "bg-butter text-saved" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="ml-auto flex gap-0.5 sm:gap-1 md:ml-0 md:flex-col md:gap-1.5">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            title={link.label}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl p-1 text-sm sm:p-1.5 font-medium transition-all focus-visible:outline-2 focus-visible:outline-spark md:justify-center lg:justify-start lg:pr-3 ${
              active ? "bg-white text-ink shadow-lift" : "text-side-muted hover:bg-white/10 hover:text-side-ink"
            }`}
          >
            <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${active ? "btn-gradient" : link.chip}`}>
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
                {ICONS[link.href]}
              </svg>
            </span>
            <span className="sr-only lg:not-sr-only">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
