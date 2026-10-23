import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getJobs, getSummary, TABS, type Tab } from "@/lib/jobs";
import { JobRow } from "./components/job-row";

type SearchParams = Promise<{ tab?: string; strong?: string }>;

const TAB_LABELS: Record<Tab, string> = {
  review: "To review",
  applied: "Applied",
  archived: "Archived",
};

// URL values are user input. hasOwn avoids tricks like ?tab=constructor
function isTab(value: string | undefined): value is Tab {
  return value !== undefined && Object.hasOwn(TABS, value);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

const EMPTY_TEXT: Record<Tab, string> = {
  review: "Nothing left to review. Run the pipeline (npm run dev in the pipeline folder) to fetch new jobs.",
  applied: "No applications yet. Mark a job as applied from To review and it moves here.",
  archived: "Nothing archived. Jobs you mark as not for me or rejected end up here.",
};

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const tab: Tab = isTab(params.tab) ? params.tab : "review";
  const strongOnly = params.strong === "1";

  // Both queries run at the same time
  const [summary, jobs] = await Promise.all([getSummary(), getJobs(tab, strongOnly)]);
  const counts: Record<Tab, number> = {
    review: summary.review,
    applied: summary.applied,
    archived: summary.archived,
  };

  return (
    <>
      <p className="mt-3 max-w-prose text-lg text-muted">
        {summary.strong > 0
          ? `${plural(summary.strong, "strong match", "strong matches")} waiting.`
          : "No strong matches right now."}{" "}
        {plural(summary.applied, "application", "applications")} in progress.
      </p>

      <nav
        aria-label="Job lists"
        className="mt-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-rule"
      >
        <ul className="flex gap-6">
          {(Object.keys(TABS) as Tab[]).map((t) => (
            <li key={t}>
              <Link
                href={{ query: { tab: t } }}
                aria-current={t === tab ? "page" : undefined}
                className={`-mb-px inline-block border-b-2 pb-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ${
                  t === tab ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {TAB_LABELS[t]} <span className="ml-1 tabular-nums text-muted">{counts[t]}</span>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href={{ query: strongOnly ? { tab } : { tab, strong: "1" } }}
          className="pb-3 text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {strongOnly ? "Show all matches" : "Show strong matches only"}
        </Link>
      </nav>

      {jobs.length === 0 ? (
        <p className="mt-10 max-w-prose text-muted">
          {strongOnly ? "No strong matches here. Show all matches to see the rest." : EMPTY_TEXT[tab]}
        </p>
      ) : (
        <ol className="divide-y divide-rule">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </ol>
      )}
    </>
  );
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl">job-radar</h1>
      <Suspense fallback={<p className="mt-3 text-lg text-muted">Loading your matches…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}