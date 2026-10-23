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

// Reusable SQL pieces. Functions, so every query gets its own copy.
const columns = () => sql`
  id, company, title, location, url, source, fit_score, fit_reasons,
  status, employment, seniority, first_seen_at, status_changed_at, opened_at, min_years, experience_text`;
// The roles this dashboard is for. Every list and count uses it, so senior roles never show up;
// only the Applied board skips it, since it shows whatever you applied to.
const isTarget = () => sql`category = 'developer' AND seniority IN ('fresher', 'entry')`;
// The same jobs with a "target" flag, for joins that need every job but count only targets
const jobsWithTarget = () => sql`(SELECT *, (${isTarget()}) AS target FROM jobs)`;
const isOpen = () => sql`last_seen_at > now() - interval '3 days'`;
const num = (v: unknown) => Number(v ?? 0);

export async function getOverview() {
  const [jobs, pipeline, companies] = await Promise.all([
    sql`
      SELECT
        count(*) FILTER (WHERE first_seen_at > now() - interval '24 hours') AS new_today,
        count(*) FILTER (WHERE status = 'new' AND fit_score >= 80) AS strong,
        count(*) FILTER (WHERE status = 'new') AS to_review,
        count(*) FILTER (WHERE status = 'new' AND fit_score IS NULL) AS unscored
      FROM jobs WHERE ${isTarget()} AND ${isOpen()}`,
    sql`
      SELECT
        count(*) FILTER (WHERE status IN ('applied', 'interviewing', 'offer')) AS active,
        count(*) FILTER (WHERE status = 'interviewing') AS interviewing
      FROM jobs`,
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

export async function getTopMatches(limit: number): Promise<JobRow[]> {
  const rows = await sql`
    SELECT ${columns()} FROM jobs
    WHERE ${isTarget()} AND ${isOpen()} AND status = 'new' AND fit_score IS NOT NULL
    ORDER BY fit_score DESC, first_seen_at DESC
    LIMIT ${limit}`;
  return rows as JobRow[];
}

export async function getJobs(f: JobFilters): Promise<{ rows: JobRow[]; total: number; counts: { review: number; saved: number } }> {
  const like = `%${f.q}%`;
  const minScore = f.score === "any" ? 0 : Number(f.score);

  const status = f.view === "saved" ? "saved" : "new";
  const pattern = LOCATIONS[f.loc].pattern;
  const days = f.posted === "any" ? 0 : Number(f.posted);

  const where = () => sql`
    ${isTarget()} AND ${isOpen()} AND status = ${status}
    AND (${pattern === null} OR location ~* ${pattern ?? ""} OR (${f.loc === "remote"} AND is_remote))
    AND (${days === 0} OR first_seen_at > now() - make_interval(days => ${days}))
    AND (${f.q === ""} OR title ILIKE ${like} OR company ILIKE ${like})
    AND (${f.type === "all"} OR employment = ${f.type})
    AND (${f.level === "all"} OR seniority = 'fresher')
    AND (${f.score === "any"} OR fit_score >= ${minScore})`;

  const order =
    f.sort === "newest"
      ? sql`first_seen_at DESC`
      : sql`fit_score DESC NULLS LAST, first_seen_at DESC`;

  const [rows, count, tabs] = await Promise.all([
    sql`SELECT ${columns()} FROM jobs WHERE ${where()}
        ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET ${(f.page - 1) * PAGE_SIZE}`,
    sql`SELECT count(*) AS total FROM jobs WHERE ${where()}`,
    sql`SELECT count(*) FILTER (WHERE status = 'new') AS review, count(*) FILTER (WHERE status = 'saved') AS saved
        FROM jobs WHERE ${isTarget()} AND ${isOpen()}`,
  ]);

  return {
    rows: rows as JobRow[],
    total: num(count[0]?.total),
    counts: { review: num(tabs[0]?.review), saved: num(tabs[0]?.saved) },
  };
}

export async function getJob(id: string): Promise<JobDetail | null> {
  const rows = await sql`SELECT ${columns()}, description, description_html, notes FROM jobs WHERE id = ${id}`;
  return (rows[0] as JobDetail | undefined) ?? null;
}

// Jobs you opened on the company site in the last week but haven't confirmed applying to
export async function getOpenedPending(limit = 10): Promise<JobRow[]> {
  const rows = await sql`
    SELECT ${columns()} FROM jobs
    WHERE ${isTarget()} AND status IN ('new', 'saved') AND opened_at > now() - interval '7 days'
    ORDER BY opened_at DESC
    LIMIT ${limit}`;
  return rows as JobRow[];
}

export type BoardRow = JobRow & { notes: string };

export async function getBoard(): Promise<BoardRow[]> {
  const rows = await sql`
    SELECT ${columns()}, notes FROM jobs
    WHERE status IN ('saved', 'applied', 'interviewing', 'offer', 'rejected')
    ORDER BY status_changed_at DESC NULLS LAST`;
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
}

export async function getCompanies(): Promise<CompanyRow[]> {
  const rows = await sql`
    SELECT c.source, c.slug, c.india_jobs, c.last_checked_at, c.name, c.added_by = 'dashboard' AS added_by_you,
           count(j.id) FILTER (WHERE j.target AND j.last_seen_at > now() - interval '3 days') AS dev_roles,
           max(j.fit_score) FILTER (WHERE j.target) AS best_score
    FROM companies c
    -- careers jobs are stored under the employer's name, other sources under the board slug
    LEFT JOIN ${jobsWithTarget()} j ON j.source = c.source
      AND lower(j.company) = lower(CASE WHEN c.source = 'careers' THEN coalesce(c.name, c.slug) ELSE c.slug END)
    WHERE c.india_jobs > 0 OR c.added_by = 'dashboard'
    GROUP BY c.source, c.slug, c.india_jobs, c.last_checked_at, c.name, c.added_by, c.added_at
    ORDER BY (c.added_by = 'dashboard') DESC, c.added_at DESC NULLS LAST, dev_roles DESC, c.india_jobs DESC`;

  return rows.map((r) => ({
    source: String(r.source),
    slug: String(r.slug),
    india_jobs: num(r.india_jobs),
    dev_roles: num(r.dev_roles),
    best_score: r.best_score === null ? null : num(r.best_score),
    last_checked_at: r.last_checked_at,
    name: r.name === null ? null : String(r.name),
    added_by_you: Boolean(r.added_by_you),
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

export async function getInsights() {
  const [perDay, buckets, companies, missing] = await Promise.all([
    sql`
      SELECT to_char(d, 'YYYY-MM-DD') AS day, count(j.id) AS n
      FROM generate_series(current_date - 13, current_date, interval '1 day') d
      LEFT JOIN ${jobsWithTarget()} j ON j.first_seen_at::date = d::date AND j.target
      GROUP BY d ORDER BY d`,
    sql`
      SELECT least(floor(fit_score / 10), 9) AS b, count(*) AS n
      FROM jobs WHERE ${isTarget()} AND ${isOpen()} AND fit_score IS NOT NULL
      GROUP BY 1`,
    sql`
      SELECT company, count(*) AS n FROM jobs
      WHERE ${isTarget()} AND ${isOpen()} AND status = 'new'
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 8`,
    sql`
      SELECT fit_reasons FROM jobs
      WHERE ${isTarget()} AND ${isOpen()} AND fit_reasons IS NOT NULL`,
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
export async function getMomentum() {
  const [r] = await sql`
    SELECT
      count(*) FILTER (
        WHERE status IN ('applied', 'interviewing', 'offer')
          AND status_changed_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
      ) AS today,
      count(*) FILTER (
        WHERE status IN ('applied', 'interviewing', 'offer') AND status_changed_at > now() - interval '7 days'
      ) AS week,
      count(*) FILTER (WHERE status = 'new' AND fit_score >= 80 AND ${isTarget()} AND ${isOpen()}) AS strong
    FROM jobs`;
  return { today: num(r?.today), week: num(r?.week), strong: num(r?.strong) };
}
