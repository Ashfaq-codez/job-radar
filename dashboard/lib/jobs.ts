import "server-only";
import { sql } from "./db";
import { LOCATIONS, type JobFilters } from "./filters";

export const STATUSES = ["new", "saved", "applied", "interviewing", "offer", "rejected", "hidden"] as const;
export type Status = (typeof STATUSES)[number];

export interface JobRow {
  id: string;
  company: string;
  title: string;
  location: string;
  url: string;
  source: string;
  fit_score: number | null;
  fit_reasons: string | null;
  status: Status;
  employment: "internship" | "full_time" | null;
  seniority: "fresher" | "entry" | "senior" | null;
  first_seen_at: Date | string;
  status_changed_at: Date | string | null;
  opened_at: Date | string | null;      // "Apply on company site" clicked, not yet confirmed
  min_years: number | null;
  experience_text: string | null;
}

export interface JobDetail extends JobRow {
  description: string;
  description_html: string; // sanitized by the pipeline before it is stored
  notes: string;
}

export const PAGE_SIZE = 30;

// Every query below is for ONE person: jobs are shared, but scores, statuses and notes
// live in user_jobs, keyed by user_id. Callers pass the signed-in user's id from lib/session.ts.

// Reusable SQL pieces. Functions, so every query gets its own copy.
const columns = () => sql`
  j.id, j.company, j.title, j.location, j.url, j.source, uj.fit_score, uj.fit_reasons,
  uj.status, j.employment, j.seniority, j.first_seen_at, uj.status_changed_at, uj.opened_at,
  j.min_years, j.experience_text`;
// This person's jobs: the shared row joined with their own
const mine = (userId: string) => sql`jobs j JOIN user_jobs uj ON uj.job_id = j.id AND uj.user_id = ${userId}`;
// Jobs that fit their profile right now (set by the pipeline's matcher). Every list and count
// uses it; only the Applied board skips it, since it shows whatever they applied to.
const isTarget = () => sql`uj.matched`;
const isOpen = () => sql`j.last_seen_at > now() - interval '3 days'`;
const num = (v: unknown) => Number(v ?? 0);

export async function getOverview(userId: string) {
  const [jobs, pipeline, companies] = await Promise.all([
    sql`
      SELECT
        count(*) FILTER (WHERE j.first_seen_at > now() - interval '24 hours') AS new_today,
        count(*) FILTER (WHERE uj.status = 'new' AND uj.fit_score >= 80) AS strong,
        count(*) FILTER (WHERE uj.status = 'new') AS to_review,
        count(*) FILTER (WHERE uj.status = 'new' AND uj.fit_score IS NULL) AS unscored
      FROM ${mine(userId)} WHERE ${isTarget()} AND ${isOpen()}`,
    sql`
      SELECT
        count(*) FILTER (WHERE uj.status IN ('applied', 'interviewing', 'offer')) AS active,
        count(*) FILTER (WHERE uj.status = 'interviewing') AS interviewing
      FROM ${mine(userId)}`,
    sql`SELECT count(*) FILTER (WHERE india_jobs > 0) AS tracked FROM companies`,
  ]);

  return {
    newToday: num(jobs[0]?.new_today),
    strong: num(jobs[0]?.strong),
    toReview: num(jobs[0]?.to_review),
    unscored: num(jobs[0]?.unscored),
    active: num(pipeline[0]?.active),
    interviewing: num(pipeline[0]?.interviewing),
    companies: num(companies[0]?.tracked),
  };
}

export async function getTopMatches(userId: string, limit: number): Promise<JobRow[]> {
  const rows = await sql`
    SELECT ${columns()} FROM ${mine(userId)}
    WHERE ${isTarget()} AND ${isOpen()} AND uj.status = 'new' AND uj.fit_score IS NOT NULL
    ORDER BY uj.fit_score DESC, j.first_seen_at DESC
    LIMIT ${limit}`;
  return rows as JobRow[];
}

export async function getJobs(userId: string, f: JobFilters): Promise<{ rows: JobRow[]; total: number; counts: { review: number; saved: number } }> {
  const like = `%${f.q}%`;
  const minScore = f.score === "any" ? 0 : Number(f.score);

  const status = f.view === "saved" ? "saved" : "new";
  const pattern = LOCATIONS[f.loc].pattern;
  const days = f.posted === "any" ? 0 : Number(f.posted);

  const where = () => sql`
    ${isTarget()} AND ${isOpen()} AND uj.status = ${status}
    AND (${pattern === null} OR j.location ~* ${pattern ?? ""} OR (${f.loc === "remote"} AND j.is_remote))
    AND (${days === 0} OR j.first_seen_at > now() - make_interval(days => ${days}))
    AND (${f.q === ""} OR j.title ILIKE ${like} OR j.company ILIKE ${like})
    AND (${f.type === "all"} OR j.employment = ${f.type})
    AND (${f.level === "all"} OR j.seniority = 'fresher')
    AND (${f.score === "any"} OR uj.fit_score >= ${minScore})`;

  const order =
    f.sort === "newest"
      ? sql`j.first_seen_at DESC`
      : sql`uj.fit_score DESC NULLS LAST, j.first_seen_at DESC`;

  const [rows, count, tabs] = await Promise.all([
    sql`SELECT ${columns()} FROM ${mine(userId)} WHERE ${where()}
        ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET ${(f.page - 1) * PAGE_SIZE}`,
    sql`SELECT count(*) AS total FROM ${mine(userId)} WHERE ${where()}`,
    sql`SELECT count(*) FILTER (WHERE uj.status = 'new') AS review, count(*) FILTER (WHERE uj.status = 'saved') AS saved
        FROM ${mine(userId)} WHERE ${isTarget()} AND ${isOpen()}`,
  ]);

  return {
    rows: rows as JobRow[],
    total: num(count[0]?.total),
    counts: { review: num(tabs[0]?.review), saved: num(tabs[0]?.saved) },
  };
}

// Only jobs in this person's user_jobs: someone else's (or an unmatched) job id returns null
export async function getJob(userId: string, id: string): Promise<JobDetail | null> {
  const rows = await sql`
    SELECT ${columns()}, j.description, j.description_html, uj.notes
    FROM ${mine(userId)} WHERE j.id = ${id}`;
  return (rows[0] as JobDetail | undefined) ?? null;
}

// Jobs opened on the company site in the last week but not confirmed as applied
export async function getOpenedPending(userId: string, limit = 10): Promise<JobRow[]> {
  const rows = await sql`
    SELECT ${columns()} FROM ${mine(userId)}
    WHERE ${isTarget()} AND uj.status IN ('new', 'saved') AND uj.opened_at > now() - interval '7 days'
    ORDER BY uj.opened_at DESC
    LIMIT ${limit}`;
  return rows as JobRow[];
}

export type BoardRow = JobRow & { notes: string };

export async function getBoard(userId: string): Promise<BoardRow[]> {
  const rows = await sql`
    SELECT ${columns()}, uj.notes FROM ${mine(userId)}
    WHERE uj.status IN ('saved', 'applied', 'interviewing', 'offer', 'rejected')
    ORDER BY uj.status_changed_at DESC NULLS LAST`;
  return rows as BoardRow[];
}

export interface CompanyRow {
  source: string;
  slug: string;
  india_jobs: number;
  dev_roles: number;
  best_score: number | null;
  last_checked_at: Date | string | null;
  name: string | null;
  added_by_you: boolean;
  removable: boolean;
}

// Companies are shared; the role counts and best score are this person's
export async function getCompanies(userId: string, isOwner: boolean): Promise<CompanyRow[]> {
  const rows = await sql`
    SELECT c.source, c.slug, c.india_jobs, c.last_checked_at, c.name,
           c.added_by_user = ${userId} AS added_by_you,
           c.added_by = 'dashboard' AND (c.added_by_user = ${userId} OR ${isOwner}) AS removable,
           count(m.job_id) FILTER (WHERE m.open) AS dev_roles,
           max(m.fit_score) AS best_score
    FROM companies c
    -- careers jobs are stored under the employer's name, other sources under the board slug
    LEFT JOIN (
      SELECT j.source, j.company, uj.job_id, uj.fit_score, ${isOpen()} AS open
      FROM ${mine(userId)} WHERE ${isTarget()}
    ) m ON m.source = c.source
      AND lower(m.company) = lower(CASE WHEN c.source = 'careers' THEN coalesce(c.name, c.slug) ELSE c.slug END)
    WHERE c.india_jobs > 0 OR c.added_by = 'dashboard'
    GROUP BY c.source, c.slug, c.india_jobs, c.last_checked_at, c.name, c.added_by, c.added_by_user, c.added_at
    ORDER BY (c.added_by_user = ${userId}) DESC NULLS LAST, c.added_at DESC NULLS LAST, dev_roles DESC, c.india_jobs DESC`;

  return rows.map((r) => ({
    source: String(r.source),
    slug: String(r.slug),
    india_jobs: num(r.india_jobs),
    dev_roles: num(r.dev_roles),
    best_score: r.best_score === null ? null : num(r.best_score),
    last_checked_at: r.last_checked_at,
    name: r.name === null ? null : String(r.name),
    added_by_you: Boolean(r.added_by_you),
    removable: Boolean(r.removable),
  }));
}

// Skills worth tracking: the AI's "missing" notes are free text, so count jobs that mention each one
const SKILLS: [label: string, pattern: RegExp][] = [
  ["Java", /\bjava\b(?!script)/i], ["Python", /python/i], ["Go", /\bgo(lang)?\b/i], ["C++", /c\+\+/i],
  ["Spring Boot", /spring/i], ["Kafka", /kafka/i], ["Redis", /redis/i], ["AWS", /\baws\b/i],
  ["GCP", /\bgcp\b|google cloud/i], ["Azure", /azure/i], ["Docker", /docker/i], ["Kubernetes", /kubernetes|\bk8s\b/i],
  ["CI/CD", /ci\/cd|jenkins|github actions/i], ["Microservices", /microservice/i], ["System design", /system design|distributed/i],
  ["Testing (TDD)", /\btdd\b|unit test|testing/i], ["Machine learning", /machine learning|\bml\b|deep learning/i],
  ["Mobile", /android|ios|kotlin|swift|flutter|react native/i], ["GraphQL", /graphql/i], ["Linux / shell", /linux|unix|shell/i],
];

export async function getInsights(userId: string) {
  const [perDay, buckets, companies, missing] = await Promise.all([
    sql`
      SELECT to_char(d, 'YYYY-MM-DD') AS day, count(j.id) AS n
      FROM generate_series(current_date - 13, current_date, interval '1 day') d
      LEFT JOIN (SELECT j.id, j.first_seen_at FROM ${mine(userId)} WHERE ${isTarget()}) j
        ON j.first_seen_at::date = d::date
      GROUP BY d ORDER BY d`,
    sql`
      SELECT least(floor(uj.fit_score / 10), 9) AS b, count(*) AS n
      FROM ${mine(userId)} WHERE ${isTarget()} AND ${isOpen()} AND uj.fit_score IS NOT NULL
      GROUP BY 1`,
    sql`
      SELECT j.company, count(*) AS n FROM ${mine(userId)}
      WHERE ${isTarget()} AND ${isOpen()} AND uj.status = 'new'
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 8`,
    sql`
      SELECT uj.fit_reasons FROM ${mine(userId)}
      WHERE ${isTarget()} AND ${isOpen()} AND uj.fit_reasons IS NOT NULL`,
  ]);

  const byBucket = new Map(buckets.map((r) => [num(r.b), num(r.n)]));
  const skillCounts = new Map<string, number>();
  for (const r of missing) {
    let gaps: string[] = [];
    try {
      gaps = (JSON.parse(String(r.fit_reasons)).missing ?? []) as string[];
    } catch {
      continue;
    }
    const text = gaps.join(" | ");
    for (const [label, re] of SKILLS) if (re.test(text)) skillCounts.set(label, (skillCounts.get(label) ?? 0) + 1);
  }

  return {
    perDay: perDay.map((r) => ({ day: String(r.day), n: num(r.n) })),
    scores: Array.from({ length: 10 }, (_, b) => ({ from: b * 10, n: byBucket.get(b) ?? 0 })),
    companies: companies.map((r) => ({ company: String(r.company), n: num(r.n) })),
    skills: [...skillCounts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([skill, n]) => ({ skill, n })),
    scoredJobs: missing.length,
  };
}

// Sidebar momentum: applications sent today (India time) and this week, plus strong matches waiting.
// "Sent" = moved into applied/interviewing/offer, judged by when the status last changed.
export async function getMomentum(userId: string) {
  const [r] = await sql`
    SELECT
      count(*) FILTER (
        WHERE uj.status IN ('applied', 'interviewing', 'offer')
          AND uj.status_changed_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
      ) AS today,
      count(*) FILTER (
        WHERE uj.status IN ('applied', 'interviewing', 'offer') AND uj.status_changed_at > now() - interval '7 days'
      ) AS week,
      count(*) FILTER (WHERE uj.status = 'new' AND uj.fit_score >= 80 AND ${isTarget()} AND ${isOpen()}) AS strong
    FROM ${mine(userId)}`;
  return { today: num(r?.today), week: num(r?.week), strong: num(r?.strong) };
}
