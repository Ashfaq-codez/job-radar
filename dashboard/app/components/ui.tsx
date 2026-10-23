import type { JobRow, Status } from "@/lib/jobs";
import { scoreColor, STATUS_LABEL, STATUS_PILL } from "@/lib/format";

// Fit score as a pill whose colour slides from red (0) through orange to green (100)
export function Score({ score, size = "md" }: { score: number | null; size?: "md" | "lg" }) {
  const big = size === "lg";
  if (score === null) {
    return (
      <span className={`inline-flex items-center rounded-xl bg-subtle font-medium text-faint ${big ? "px-3 py-2 text-sm" : "px-2 py-1 text-xs"}`}>
        Unscored
      </span>
    );
  }

  const { text, fill } = scoreColor(score);
  return (
    <span
      className={`inline-flex items-baseline gap-0.5 rounded-full font-semibold tabular-nums ${big ? "px-3 py-1.5 text-3xl" : "px-2 py-0.5 text-base"}`}
      style={{ color: text, backgroundColor: fill }}
    >
      {score}
      <span className={`font-medium opacity-60 ${big ? "text-sm" : "text-[10px]"}`}>/100</span>
      <span className="sr-only">fit score</span>
    </span>
  );
}

export function RoleBadges({ job }: { job: Pick<JobRow, "employment" | "seniority"> }) {
  return (
    <>
      <Tag>{job.employment === "internship" ? "Internship" : "Full-time"}</Tag>
      {job.seniority === "fresher" && <Tag>Fresher</Tag>}
    </>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-subtle px-2 py-0.5 text-[11px] font-medium text-muted">
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_PILL[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-gradient text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

export function Loading() {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-36 animate-pulse rounded-2xl border border-rule bg-surface" />
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-rule px-6 py-14 text-center">
      {title && <p className="text-sm font-medium">{title}</p>}
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}
