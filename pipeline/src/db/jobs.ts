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