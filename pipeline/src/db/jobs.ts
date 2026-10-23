import { sql } from "./client.js";
import type { Job } from "../types.js";
import { classify } from "../classify.js";

export async function upsertJobs(
  jobs: Job[]
): Promise<{ newIds: string[]; seenCount: number }> {
  if (jobs.length === 0) return { newIds: [], seenCount: 0 };

  // Attach the labels to each job before saving
  const rowsIn = jobs.map((job) => ({ ...job, ...classify(job.title) }));

  const rows = await sql`
    INSERT INTO jobs (id, source, company, title, location, is_remote, url, posted_at,
                      description, description_html, category, employment, seniority)
    SELECT id, source, company, title, location, "isRemote", url, "postedAt",
           description, "descriptionHtml", category, employment, seniority
    FROM jsonb_to_recordset(${JSON.stringify(rowsIn)}::jsonb) AS j(
      id text, source text, company text, title text, location text,
      "isRemote" boolean, url text, "postedAt" timestamptz, description text, "descriptionHtml" text,
      category text, employment text, seniority text
    )
    ON CONFLICT (id) DO UPDATE SET
      title        = EXCLUDED.title,
      location     = EXCLUDED.location,
      is_remote    = EXCLUDED.is_remote,
      url          = EXCLUDED.url,
      description  = EXCLUDED.description,
      description_html = EXCLUDED.description_html,
      category     = EXCLUDED.category,
      employment   = EXCLUDED.employment,
      seniority    = EXCLUDED.seniority,
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

// Entry-level developer jobs with a description that the AI hasn't scored yet
export async function getUnscoredJobs(): Promise<JobToScore[]> {
  const rows = await sql`
    SELECT id, company, title, location, description
    FROM jobs
    WHERE scored_at IS NULL
      AND description <> ''
      AND category = 'developer'
      AND seniority IN ('fresher', 'entry')
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
export type JobToNotify = {
  id: string;
  company: string;
  title: string;
  location: string;
  url: string;
  fit_score: number;
  fit_reasons: string | null;
  employment: string | null;
  seniority: string;
};

// Strong entry-level matches that haven't been sent to Discord yet
export async function getJobsToNotify(minScore: number, limit: number) {
  const rows = await sql`
    SELECT id, company, title, location, url, fit_score, fit_reasons, employment, seniority
    FROM jobs
    WHERE category = 'developer'
      AND seniority IN ('fresher', 'entry')
      AND status = 'new'
      AND fit_score >= ${minScore}
      AND notified_at IS NULL
      AND last_seen_at > now() - interval '3 days'
    ORDER BY fit_score DESC
    LIMIT ${limit}
  `;
  return rows as JobToNotify[];
}

export async function markNotified(ids: string[]) {
  await sql`UPDATE jobs SET notified_at = now() WHERE id = ANY(${ids}) AND notified_at IS NULL`;
}
