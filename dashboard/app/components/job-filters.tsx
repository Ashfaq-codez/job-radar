import Link from "next/link";
import { LOCATIONS, type JobFilters, type LocationKey } from "@/lib/filters";
import { hrefWith, type SP } from "@/lib/url";
import { FilterMenu } from "./filter-menu";

export function JobTabs({ sp, f, counts }: { sp: SP; f: JobFilters; counts: { review: number; saved: number } }) {
  const tabs = [
    { view: "review", label: "To review", n: counts.review },
    { view: "saved", label: "Saved", n: counts.saved },
  ] as const;

  return (
    <div role="tablist" className="inline-flex gap-1 rounded-2xl border border-rule bg-surface p-1 shadow-card">
      {tabs.map((t) => {
        const active = f.view === t.view;
        return (
          <Link
            key={t.view}
            role="tab"
            aria-selected={active}
            href={hrefWith("/jobs", sp, { view: t.view === "review" ? null : t.view, page: null, job: null })}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active ? "btn-gradient" : "text-muted hover:bg-subtle hover:text-ink"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? "bg-white/25 text-white" : "bg-accent-soft text-accent"}`}>
              {t.n}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function JobFiltersBar({ sp, f }: { sp: SP; f: JobFilters }) {
  // Changing a filter resets to page 1 and closes any open job
  const to = (key: string, value: string) => hrefWith("/jobs", sp, { [key]: value, page: null, job: null });
  const opts = (key: string, current: string, choices: [string, string][]) =>
    choices.map(([value, label]) => ({ label, href: to(key, value), active: current === value }));

  const filtered = f.type !== "all" || f.level !== "all" || f.score !== "any" || f.loc !== "any" || f.posted !== "any" || f.q !== "";
  const clearHref = hrefWith("/jobs", sp, { type: null, level: null, score: null, loc: null, posted: null, q: null, page: null, job: null });
  const locations = (Object.keys(LOCATIONS) as LocationKey[]).map((k) => [k, LOCATIONS[k].label] as [string, string]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterMenu label="Match" isDefault={f.score === "any"}
        options={opts("score", f.score, [["any", "Any"], ["50", "50+"], ["80", "80+"]])} />
      <FilterMenu label="Type" isDefault={f.type === "all"}
        options={opts("type", f.type, [["all", "All"], ["internship", "Internship"], ["full_time", "Full-time"]])} />
      <FilterMenu label="Level" isDefault={f.level === "all"}
        options={opts("level", f.level, [["all", "Any"], ["fresher", "Fresher only"]])} />
      <FilterMenu label="Location" isDefault={f.loc === "any"} options={opts("loc", f.loc, locations)} />
      <FilterMenu label="Posted" isDefault={f.posted === "any"}
        options={opts("posted", f.posted, [["any", "Any time"], ["1", "Last 24 hours"], ["7", "Last 7 days"], ["30", "Last 30 days"]])} />
      {filtered && (
        <Link href={clearHref} className="h-8 rounded-xl px-2.5 text-sm leading-8 text-muted transition-colors hover:bg-subtle hover:text-ink">
          Clear
        </Link>
      )}
      <div className="ml-auto">
        <FilterMenu label="Sort" isDefault align="right"
          options={opts("sort", f.sort, [["score", "Best match"], ["newest", "Newest"]])} />
      </div>
    </div>
  );
}
