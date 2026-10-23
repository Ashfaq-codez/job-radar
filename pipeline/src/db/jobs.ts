import { sql } from "./client.js";
import type { Job } from "../types.js";
import { classify } from "../classify.js";

export async function upsertJobs(
  jobs: Job[]
): Promise<{ newIds: string[]; seenCount: number }> {
  if (jobs.length === 0) return { newIds: [], seenCount: 0 };

  // Attach the labels to each job before saving
  const rowsIn = jobs.map((job) => ({ ...job, ...classify(job.title, job.description) }));

  const rows = await sql`
    INSERT INTO jobs (id, source, company, title, location, is_remote, url, posted_at,
                      description, description_html, category, employment, seniority,
                      min_years, experience_text, role_family)
    SELECT id, source, company, title, location, "isRemote", url, "postedAt",
           description, "descriptionHtml", category, employment, seniority,
           "minYears", "experienceText", "roleFamily"
    FROM jsonb_to_recordset(${JSON.stringify(rowsIn)}::jsonb) AS j(
      id text, source text, company text, title text, location text,
      "isRemote" boolean, url text, "postedAt" timestamptz, description text, "descriptionHtml" text,
      category text, employment text, seniority text, "minYears" integer, "experienceText" text, "roleFamily" text
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
      min_years    = EXCLUDED.min_years,
      experience_text = EXCLUDED.experience_text,
      role_family  = EXCLUDED.role_family,
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
