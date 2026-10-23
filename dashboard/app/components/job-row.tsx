import { setStatus } from "../actions";
import { ActionButton } from "./action-button";
import type { MatchRow, Status } from "@/lib/jobs";

type Fit = { verdict: string; reasons: string[]; missing: string[] };
type Tier = "strong" | "mid" | "low";

function parseFit(raw: string | null): Fit | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Fit;
  } catch {
    return null;
  }
}

function tierFor(score: number): Tier {
  if (score >= 80) return "strong";
  if (score >= 50) return "mid";
  return "low";
}

// Full class names written out: Tailwind only includes classes it can see in your code
const TIER_TEXT: Record<Tier, string> = { strong: "text-strong", mid: "text-mid", low: "text-low" };
const TIER_BAR: Record<Tier, string> = { strong: "bg-strong", mid: "bg-mid", low: "bg-low" };

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function daysAgo(value: Date | string): string {
  const days = Math.round((new Date(value).getTime() - Date.now()) / 86_400_000);
  return rtf.format(days, "day"); // "today", "yesterday", "3 days ago"
}

const STATUS_TEXT: Record<Status, string> = {
  new: "Found",
  applied: "Applied",
  interviewing: "Interview scheduled",
  offer: "Offer received",
  rejected: "Rejected",
  hidden: "Hidden",
};

// The buttons each status gets, i.e. the next step in the flow
const STEPS: Record<Status, { to: Status; label: string; primary?: boolean }[]> = {
  new: [
    { to: "applied", label: "Mark as applied", primary: true },
    { to: "hidden", label: "Not for me" },
  ],
  applied: [
    { to: "interviewing", label: "Got an interview", primary: true },
    { to: "rejected", label: "Mark as rejected" },
  ],
  interviewing: [
    { to: "offer", label: "Got an offer", primary: true },
    { to: "rejected", label: "Mark as rejected" },
  ],
  offer: [],
  rejected: [{ to: "new", label: "Move to review" }],
  hidden: [{ to: "new", label: "Move to review" }],
};

function SignalMeter({ score, tier }: { score: number; tier: Tier }) {
  const lit = Math.max(1, Math.ceil(score / 20)); // 0-100 → 1-5 bars
  return (
    <div className="flex items-end gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`w-[5px] rounded-[1px] ${n <= lit ? TIER_BAR[tier] : "bg-rule"}`}
          style={{ height: `${4 + n * 4}px` }}
        />
      ))}
    </div>
  );
}

export function JobRow({ job }: { job: MatchRow }) {
  const fit = parseFit(job.fit_reasons);
  const tier = tierFor(job.fit_score);
  const [firstReason, ...moreReasons] = fit?.reasons ?? [];
  const when = job.status === "new" ? job.first_seen_at : (job.status_changed_at ?? job.first_seen_at);

  return (
    <li className="grid grid-cols-[4rem_1fr] gap-x-5 gap-y-4 py-6 md:grid-cols-[5rem_1fr_11rem]">
      {/* Score readout */}
      <div className="flex flex-col items-start gap-2">
        <span className={`font-display text-5xl font-bold leading-none tabular-nums ${TIER_TEXT[tier]}`}>
          {job.fit_score}
        </span>
        <SignalMeter score={job.fit_score} tier={tier} />
        <span className="sr-only">Fit score {job.fit_score} out of 100</span>
      </div>

      {/* Job details */}
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-snug">{job.title}</h2>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="font-medium text-ink">{job.company}</span>
          <span>{job.location}</span>
          <span>
            {STATUS_TEXT[job.status]} {daysAgo(when)}
          </span>
        </p>

        {firstReason && <p className="mt-3 max-w-prose text-[15px] leading-relaxed">{firstReason}</p>}

        {moreReasons.length > 0 && (
          <details className="mt-2 max-w-prose text-sm">
            <summary className="cursor-pointer text-muted hover:text-ink">Why this score</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
              {moreReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </details>
        )}

        {fit && fit.missing.length > 0 && (
          <p className="mt-3 max-w-prose text-sm text-muted">
            <span className="font-medium text-ink">Not on your resume:</span> {fit.missing.join(", ")}
          </p>
        )}
      </div>

      {/* Actions: below the details on phones, a right-hand column on wider screens */}
      <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1 md:flex-col md:items-stretch">
        {STEPS[job.status].map((step) => (
          <form key={step.to} action={setStatus}>
            <input type="hidden" name="id" value={job.id} />
            <input type="hidden" name="status" value={step.to} />
            <ActionButton primary={step.primary}>{step.label}</ActionButton>
          </form>
        ))}
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md px-3 py-2 text-center text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Open posting
        </a>
      </div>
    </li>
  );
}