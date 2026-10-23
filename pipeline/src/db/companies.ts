import { sql } from "./client.js";
import type { CompanyTarget, Source } from "../types.js";

// Save newly discovered boards; ignore ones we already know
export async function addCandidates(boards: CompanyTarget[]): Promise<number> {
  if (boards.length === 0) return 0;
  const rows = await sql`
    INSERT INTO companies (source, slug)
    SELECT source, slug
    FROM jsonb_to_recordset(${JSON.stringify(boards)}::jsonb) AS c(source text, slug text)
    ON CONFLICT (source, slug) DO NOTHING
    RETURNING slug
  `;
  return rows.length;
}

// Boards never checked come first, then ones not checked for 7 days
export async function getCompaniesToCheck(limit: number): Promise<CompanyTarget[]> {
  const rows = await sql`
    SELECT source, slug FROM companies
    WHERE last_checked_at IS NULL OR last_checked_at < now() - interval '7 days'
    ORDER BY last_checked_at NULLS FIRST
    LIMIT ${limit}
  `;
  return rows as CompanyTarget[];
}

export async function saveCheck(
  source: Source,
  slug: string,
  indiaJobs: number,
  totalJobs: number,
  error: string | null
) {
  await sql`
    UPDATE companies
    SET india_jobs = ${indiaJobs}, total_jobs = ${totalJobs},
        check_error = ${error}, last_checked_at = now()
    WHERE source = ${source} AND slug = ${slug}
  `;
}

// The boards the daily pipeline should fetch
export async function getActiveCompanies(): Promise<CompanyTarget[]> {
  const rows = await sql`
    SELECT source, slug FROM companies
    WHERE india_jobs > 0
    ORDER BY india_jobs DESC
  `;
  return rows as CompanyTarget[];
}