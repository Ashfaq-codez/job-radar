import Link from "next/link";
import type { JobRow } from "@/lib/jobs";
import { prettyCompany, scoreColor, timeAgo } from "@/lib/format";
import { RoleBadges, Score } from "./ui";
import { CompanyLogo } from "./company-logo";

// Presentational card; the grid passes in triage buttons, the overview shows it without them
export function JobCard({
  job,
  href,
  focused = false,
  actions,
}: {
  job: JobRow;
  href: string;
  focused?: boolean;
  actions?: React.ReactNode;
}) {
  // A wash of the score colour across the top, so strong matches glow green and weak ones warm
  const wash = job.fit_score === null ? undefined : `linear-gradient(180deg, ${scoreColor(job.fit_score).fill}, transparent 5.5rem)`;
  return (
    <article
      style={{ backgroundImage: wash }}
      data-focused={focused || undefined}
      className="group relative flex flex-col rounded-3xl border border-rule bg-surface p-4 shadow-card transition-[box-shadow,border-color,transform] hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-lift data-focused:border-accent/50 data-focused:ring-4 data-focused:ring-accent-soft"
    >
      <div className="flex items-center gap-3">
        <CompanyLogo company={job.company} url={job.url} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{prettyCompany(job.company)}</p>
          <p className="text-xs text-faint">{timeAgo(job.first_seen_at)}</p>
        </div>
        <Score score={job.fit_score} />
      </div>

      <h3 className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug">
        <Link href={href} scroll={false} className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none">
          {job.title}
        </Link>
      </h3>
      <p className="mt-1.5 flex items-center gap-1 truncate text-sm text-muted">
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-3.5 shrink-0 text-faint">
          <path d="M10 17s5.5-4.8 5.5-9a5.5 5.5 0 0 0-11 0c0 4.2 5.5 9 5.5 9z" />
          <circle cx="10" cy="8" r="2" />
        </svg>
        <span className="truncate">{job.location}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <RoleBadges job={job} />
      </div>

      {actions && <div className="relative z-10 mt-4 flex items-center gap-1 border-t border-rule pt-3">{actions}</div>}
    </article>
  );
}
