import { sql } from "./client.js";
import type { Job } from "../types.js";

export async function upsertJobs(
  jobs: Job[]
): Promise<{ newIds: string[]; seenCount: number }> {
  if (jobs.length === 0) return { newIds: [], seenCount: 0 };

  const rows = await sql`
        INSERT INTO jobs (id, source, company, title, location, is_remote, url, posted_at, description)
    SELECT id, source, company, title, location, "isRemote", url, "postedAt", description
    FROM jsonb_to_recordset(${JSON.stringify(jobs)}::jsonb) AS j(
      id text, source text, company text, title text, location text,
      "isRemote" boolean, url text, "postedAt" timestamptz, description text
    )
    ON CONFLICT (id) DO UPDATE SET
      title        = EXCLUDED.title,
      location     = EXCLUDED.location,
      is_remote    = EXCLUDED.is_remote,
      url          = EXCLUDED.url,
      description  = EXCLUDED.description,
      last_seen_at = now()
    RETURNING id, (first_seen_at = last_seen_at) AS is_new
  `;

  const newIds = rows.filter((r) => r.is_new).map((r) => String(r.id));
  return { newIds, seenCount: rows.length - newIds.length };
}

export interface JobToScore {
  id: string;
  company: string;
  title: string;
  location: string;
  description: string;
}

// Jobs never scored, with a description, roughly in India.
// ILIKE is a rough first cut; filters.ts does the precise check.
export async function getUnscoredJobs(): Promise<JobToScore[]> {
  const rows = await sql`
    SELECT id, company, title, location, description
    FROM jobs
    WHERE scored_at IS NULL
      AND description <> ''
      AND (location ILIKE '%bengaluru%' OR location ILIKE '%bangalore%' OR location ILIKE '%india%')
    ORDER BY first_seen_at DESC
  `;
  return rows as JobToScore[];
}

export async function saveScore(id: string, score: number, details: string) {
  await sql`
    UPDATE jobs
    SET fit_score = ${score}, fit_reasons = ${details}, scored_at = now()
    WHERE id = ${id}
  `;
}

// Best matches among jobs still open (seen in the last 3 days)
export async function getTopMatches(limit: number) {
  return sql`
    SELECT company, title, location, url, fit_score, fit_reasons
    FROM jobs
    WHERE fit_score IS NOT NULL
      AND last_seen_at > now() - interval '3 days'
    ORDER BY fit_score DESC
    LIMIT ${limit}
  `;
}