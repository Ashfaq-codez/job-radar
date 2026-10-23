import { sql } from "./client.js";
import type { JobToNotify, JobToScore } from "./jobs.js";
import type { MatchJob, MatchProfile } from "../match.js";

// Per-person data for the pipeline. Everything here is keyed by user_id;
// emails and resume text are never logged by callers.

export interface ActiveProfile extends MatchProfile {
  user_id: string;
  email: string;
  resume_text: string;
  experience_level: string | null;
  work_modes: string[];
  skills: string[];
  company_types: string[];
  grad_year: number | null;
  notice_period: string | null;
  min_salary_lpa: string | null; // numeric comes back as a string
  discord_webhook_url: string | null;
  min_notify_score: number;
}

// People who finished onboarding, agreed to AI scoring, and have a resume
export async function getActiveProfiles(): Promise<ActiveProfile[]> {
  const rows = await sql`
    SELECT p.*, u.email
    FROM profiles p JOIN "user" u ON u.id = p.user_id
    WHERE p.onboarded_at IS NOT NULL AND p.ai_consent_at IS NOT NULL
      AND coalesce(p.resume_text, '') <> ''
    ORDER BY p.onboarded_at`;
  return rows as ActiveProfile[];
}

export type OpenJob = MatchJob & { id: string };

// Every job still open (seen in the last 3 days), with enough text for avoid-keyword checks
export async function getOpenJobs(): Promise<OpenJob[]> {
  const rows = await sql`
    SELECT id, title, company, location, is_remote, employment, role_family, min_years,
           left(description, 4000) AS description
    FROM jobs
    WHERE last_seen_at > now() - interval '3 days'`;
  return rows as OpenJob[];
}

// Make user_jobs reflect the current matches: add new ones, flag ones that no longer fit.
// Rows are never deleted here, so scores, statuses and notes survive profile changes.
export async function syncMatches(userId: string, jobIds: string[]): Promise<{ added: number }> {
  const added = await sql`
    INSERT INTO user_jobs (user_id, job_id)
    SELECT ${userId}, unnest(${jobIds}::text[])
    ON CONFLICT (user_id, job_id) DO UPDATE SET matched = true
    RETURNING (xmax = 0) AS inserted`;
  await sql`
    UPDATE user_jobs SET matched = false
    WHERE user_id = ${userId} AND matched AND NOT (job_id = ANY(${jobIds}::text[]))`;
  return { added: added.filter((r) => r.inserted).length };
}

// Matched open jobs with a description that the AI hasn't scored for this person yet
export async function getUnscoredForUser(userId: string, limit: number): Promise<JobToScore[]> {
  if (limit <= 0) return [];
  const rows = await sql`
    SELECT j.id, j.company, j.title, j.location, j.description
    FROM user_jobs uj JOIN jobs j ON j.id = uj.job_id
    WHERE uj.user_id = ${userId} AND uj.matched AND uj.scored_at IS NULL
      AND j.description <> '' AND j.last_seen_at > now() - interval '3 days'
    ORDER BY j.first_seen_at DESC
    LIMIT ${limit}`;
  return rows as JobToScore[];
}

export async function saveUserScore(userId: string, jobId: string, score: number, details: string) {
  await sql`
    UPDATE user_jobs SET fit_score = ${score}, fit_reasons = ${details}, scored_at = now()
    WHERE user_id = ${userId} AND job_id = ${jobId}`;
}

// Strong new matches for this person that haven't been sent to Discord yet
export async function getUserJobsToNotify(userId: string, minScore: number, limit: number): Promise<JobToNotify[]> {
  const rows = await sql`
    SELECT j.id, j.company, j.title, j.location, j.url, uj.fit_score, uj.fit_reasons, j.employment, j.seniority
    FROM user_jobs uj JOIN jobs j ON j.id = uj.job_id
    WHERE uj.user_id = ${userId} AND uj.matched AND uj.status = 'new'
      AND uj.fit_score >= ${minScore} AND uj.notified_at IS NULL
      AND j.last_seen_at > now() - interval '3 days'
    ORDER BY uj.fit_score DESC
    LIMIT ${limit}`;
  return rows as JobToNotify[];
}

export async function markUserNotified(userId: string, jobIds: string[]) {
  await sql`
    UPDATE user_jobs SET notified_at = now()
    WHERE user_id = ${userId} AND job_id = ANY(${jobIds}::text[]) AND notified_at IS NULL`;
}
