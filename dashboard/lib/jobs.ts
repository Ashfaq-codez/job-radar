import "server-only";
import { sql } from "./db";

export const STATUSES = ["new", "applied", "interviewing", "offer", "rejected", "hidden"] as const;
export type Status = (typeof STATUSES)[number];

// Which statuses each tab shows
export const TABS = {
  review: ["new"],
  applied: ["applied", "interviewing", "offer"],
  archived: ["rejected", "hidden"],
} as const satisfies Record<string, readonly Status[]>;
export type Tab = keyof typeof TABS;

export interface MatchRow {
  id: string;
  company: string;
  title: string;
  location: string;
  url: string;
  fit_score: number;
  fit_reasons: string | null;
  status: Status;
  first_seen_at: Date | string;
  status_changed_at: Date | string | null;
}

export async function getJobs(tab: Tab, strongOnly: boolean): Promise<MatchRow[]> {
  const statuses = [...TABS[tab]];
  const minScore = strongOnly ? 80 : 0;
  const includeClosed = tab !== "review"; // keep tracking applied jobs even after the posting closes
  const order =
    tab === "review" ? sql`fit_score DESC, first_seen_at DESC` : sql`status_changed_at DESC NULLS LAST`;

  const rows = await sql`
    SELECT id, company, title, location, url, fit_score, fit_reasons,
           status, first_seen_at, status_changed_at
    FROM jobs
    WHERE fit_score IS NOT NULL
      AND fit_score >= ${minScore}
      AND status = ANY(${statuses})
      AND (${includeClosed} OR last_seen_at > now() - interval '3 days')
    ORDER BY ${order}
    LIMIT 100
  `;
  return rows as MatchRow[];
}

export async function getSummary() {
  const [row] = await sql`
    SELECT
      count(*) FILTER (WHERE status = 'new' AND last_seen_at > now() - interval '3 days') AS review,
      count(*) FILTER (WHERE status = 'new' AND fit_score >= 80
                       AND last_seen_at > now() - interval '3 days') AS strong,
      count(*) FILTER (WHERE status IN ('applied', 'interviewing', 'offer')) AS applied,
      count(*) FILTER (WHERE status IN ('rejected', 'hidden')) AS archived
    FROM jobs
    WHERE fit_score IS NOT NULL
  `;
  // Postgres counts arrive as strings (they can exceed JS number limits), so convert
  return {
    review: Number(row?.review ?? 0),
    strong: Number(row?.strong ?? 0),
    applied: Number(row?.applied ?? 0),
    archived: Number(row?.archived ?? 0),
  };
}