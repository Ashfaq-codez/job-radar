import { readFile } from "node:fs/promises";
import { sql } from "../db/client.js";

// One-time move from single-user to multi-user, safe to run again:
// 1. copies the per-person columns on jobs (score, status, notes, opened/notified) into user_jobs for the owner
// 2. creates the owner's profile from pipeline/data/resume.md (only if they don't have one yet)
// Run it after the owner has signed in to the dashboard once. Prints counts only.

const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
if (!ownerEmail) throw new Error("OWNER_EMAIL is missing. Add it to pipeline/.env");

const [owner] = await sql`SELECT id FROM "user" WHERE lower(email) = ${ownerEmail}`;
if (!owner) {
  throw new Error("No account for OWNER_EMAIL yet. Sign in to the dashboard once with that Google account, then run this again.");
}
const userId = String(owner.id);

// ── 1. Tracker + scores. Existing user_jobs rows win, so re-running never overwrites newer changes. ──
const copied = await sql`
  INSERT INTO user_jobs (user_id, job_id, matched, fit_score, fit_reasons, scored_at,
                         status, status_changed_at, opened_at, notified_at, notes)
  SELECT ${userId}, id, true, fit_score, fit_reasons, scored_at,
         status, status_changed_at, opened_at, notified_at, notes
  FROM jobs
  WHERE fit_score IS NOT NULL OR status <> 'new' OR notes <> ''
     OR opened_at IS NOT NULL OR notified_at IS NOT NULL
  ON CONFLICT (user_id, job_id) DO NOTHING
  RETURNING job_id`;

// ── 2. Profile from the resume file (read here, never printed) ──
let resume: string;
try {
  resume = await readFile(new URL("../../data/resume.md", import.meta.url), "utf8");
} catch {
  throw new Error("Couldn't read pipeline/data/resume.md. Put your resume there (it's git-ignored) and run again.");
}

const created = await sql`
  INSERT INTO profiles (user_id, resume_text, resume_updated_at, role_families, experience_level, max_min_years,
                        job_types, locations, ai_consent_at, onboarded_at)
  VALUES (${userId}, ${resume}, now(), ${["software_dev"]}, 'fresher', 1,
          ${["internship", "full_time"]}, ${["Bengaluru"]}, now(), now())
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id`;

const [totals] = await sql`
  SELECT count(*)::int AS rows,
         count(*) FILTER (WHERE fit_score IS NOT NULL)::int AS scored,
         count(*) FILTER (WHERE status NOT IN ('new', 'hidden'))::int AS tracked
  FROM user_jobs WHERE user_id = ${userId}`;

console.log(`Copied ${copied.length} job rows into user_jobs (rows already there were left alone).`);
console.log(created.length ? "Created your profile from resume.md." : "You already had a profile, so it was left unchanged.");
console.log(`Your user_jobs now: ${totals?.rows} rows, ${totals?.scored} scored, ${totals?.tracked} saved/applied/in progress.`);
