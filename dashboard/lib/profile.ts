import "server-only";
import { z } from "zod";
import { sql } from "./db";
import {
  COMPANY_TYPES, EXPERIENCE_LEVELS, JOB_TYPES, LOCATIONS, NOTICE_PERIODS, ROLE_FAMILIES, WORK_MODES,
  type ProfileView,
} from "./profile-options";

// Only real Discord webhooks, so the server never posts to an address someone typed in (SSRF)
const WEBHOOK = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,30}\/[\w-]{20,200}$/;
export const isDiscordWebhook = (url: string) => WEBHOOK.test(url.trim());

const values = <T extends readonly { value: string }[]>(list: T) => list.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];
const chips = z.array(z.string().trim().min(1).max(60)).max(40).transform((xs) => [...new Set(xs)]);

// Everything the profile form sends. Arrays come from FormData.getAll.
export const ProfileInput = z.object({
  role_families: z.array(z.enum(values(ROLE_FAMILIES))).max(8),
  extra_titles: chips,
  experience_level: z.enum(values(EXPERIENCE_LEVELS)),
  job_type: z.enum(values(JOB_TYPES)),
  locations: z.array(z.enum(LOCATIONS)).max(LOCATIONS.length),
  open_to_relocate: z.boolean(),
  work_modes: z.array(z.enum(values(WORK_MODES))).max(3),
  skills: chips,
  avoid_keywords: chips,
  avoid_companies: chips,
  company_types: z.array(z.enum(values(COMPANY_TYPES))).max(COMPANY_TYPES.length),
  grad_year: z.number().int().min(1990).max(2040).nullable(),
  notice_period: z.enum(NOTICE_PERIODS).nullable(),
  min_salary_lpa: z.number().min(0).max(500).nullable(),
  webhook: z.string().trim().max(300), // "" = keep the saved one
  remove_webhook: z.boolean(),
  min_notify_score: z.number().int().min(0).max(100),
}).refine((p) => p.role_families.length > 0 || p.extra_titles.length > 0, {
  message: "Pick at least one role family (or add a job title).",
  path: ["role_families"],
}).refine((p) => p.locations.length > 0 || p.open_to_relocate, {
  message: "Pick at least one location, or say you're open to relocating.",
  path: ["locations"],
}).refine((p) => p.webhook === "" || isDiscordWebhook(p.webhook), {
  message: "That isn't a Discord webhook URL. It should start with https://discord.com/api/webhooks/",
  path: ["webhook"],
});
export type ProfileInput = z.infer<typeof ProfileInput>;

const numOrNull = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : Number(v));
const strOrNull = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : String(v));
const all = (fd: FormData, k: string) => fd.getAll(k).map(String);

export function parseProfileForm(fd: FormData) {
  return ProfileInput.safeParse({
    role_families: all(fd, "role_families"),
    extra_titles: all(fd, "extra_titles"),
    experience_level: fd.get("experience_level"),
    job_type: fd.get("job_type"),
    locations: all(fd, "locations"),
    open_to_relocate: fd.get("open_to_relocate") === "on",
    work_modes: all(fd, "work_modes"),
    skills: all(fd, "skills"),
    avoid_keywords: all(fd, "avoid_keywords"),
    avoid_companies: all(fd, "avoid_companies"),
    company_types: all(fd, "company_types"),
    grad_year: numOrNull(fd.get("grad_year")),
    notice_period: strOrNull(fd.get("notice_period")),
    min_salary_lpa: numOrNull(fd.get("min_salary_lpa")),
    webhook: String(fd.get("webhook") ?? ""),
    remove_webhook: fd.get("remove_webhook") === "on",
    min_notify_score: Number(fd.get("min_notify_score") ?? 70),
  });
}

// Saves preferences. Marks onboarding done the first time.
export async function saveProfile(userId: string, p: ProfileInput): Promise<void> {
  const level = EXPERIENCE_LEVELS.find((l) => l.value === p.experience_level)!;
  const jobTypes = p.job_type === "both" ? ["internship", "full_time"] : [p.job_type];
  const webhook = p.webhook === "" ? null : p.webhook;
  await sql`
    UPDATE profiles SET
      role_families = ${p.role_families}, extra_titles = ${p.extra_titles},
      experience_level = ${p.experience_level}, max_min_years = ${level.maxMinYears},
      job_types = ${jobTypes}, locations = ${p.locations}, open_to_relocate = ${p.open_to_relocate},
      work_modes = ${p.work_modes}, skills = ${p.skills},
      avoid_keywords = ${p.avoid_keywords}, avoid_companies = ${p.avoid_companies},
      company_types = ${p.company_types}, grad_year = ${p.grad_year},
      notice_period = ${p.notice_period}, min_salary_lpa = ${p.min_salary_lpa},
      discord_webhook_url = CASE WHEN ${p.remove_webhook} THEN NULL ELSE coalesce(${webhook}, discord_webhook_url) END,
      min_notify_score = ${p.min_notify_score},
      onboarded_at = coalesce(onboarded_at, now()),
      updated_at = now()
    WHERE user_id = ${userId}`;
}

// Resume text + AI suggestions. Suggestions only fill fields that are still empty.
export async function saveResume(
  userId: string,
  text: string,
  suggest: { skills: string[]; gradYear: number | null; level: string | null; families: string[]; titles: string[] } | null,
  consent: boolean
): Promise<void> {
  const s = suggest ?? { skills: [], gradYear: null, level: null, families: [], titles: [] };
  const level = EXPERIENCE_LEVELS.find((l) => l.value === s.level);
  await sql`
    INSERT INTO profiles (user_id, resume_text, resume_updated_at, ai_consent_at,
                          skills, grad_year, experience_level, max_min_years, role_families, extra_titles)
    VALUES (${userId}, ${text}, now(), CASE WHEN ${consent} THEN now() END,
            ${s.skills}, ${s.gradYear}, ${level?.value ?? null}, ${level?.maxMinYears ?? 1}, ${s.families}, ${s.titles})
    ON CONFLICT (user_id) DO UPDATE SET
      resume_text = EXCLUDED.resume_text,
      resume_updated_at = now(),
      ai_consent_at = coalesce(profiles.ai_consent_at, EXCLUDED.ai_consent_at),
      skills = CASE WHEN cardinality(profiles.skills) = 0 THEN EXCLUDED.skills ELSE profiles.skills END,
      grad_year = coalesce(profiles.grad_year, EXCLUDED.grad_year),
      experience_level = coalesce(profiles.experience_level, EXCLUDED.experience_level),
      max_min_years = CASE WHEN profiles.experience_level IS NULL THEN EXCLUDED.max_min_years ELSE profiles.max_min_years END,
      role_families = CASE WHEN cardinality(profiles.role_families) = 0 THEN EXCLUDED.role_families ELSE profiles.role_families END,
      extra_titles = CASE WHEN cardinality(profiles.extra_titles) = 0 THEN EXCLUDED.extra_titles ELSE profiles.extra_titles END,
      updated_at = now()`;
}

export async function hasConsented(userId: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM profiles WHERE user_id = ${userId} AND ai_consent_at IS NOT NULL`;
  return rows.length > 0;
}

export async function getWebhook(userId: string): Promise<string | null> {
  const [r] = await sql`SELECT discord_webhook_url FROM profiles WHERE user_id = ${userId}`;
  return (r?.discord_webhook_url as string | null) ?? null;
}

// The profile as the UI sees it (never the webhook URL or the resume text)
export async function getProfileView(userId: string): Promise<ProfileView | null> {
  const [r] = await sql`SELECT * FROM profiles WHERE user_id = ${userId}`;
  if (!r) return null;
  const types = r.job_types as string[];
  const hook = r.discord_webhook_url as string | null;
  const date = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    hasResume: Boolean(r.resume_text),
    resumeUpdatedAt: date(r.resume_updated_at),
    roleFamilies: r.role_families as string[],
    extraTitles: r.extra_titles as string[],
    experienceLevel: (r.experience_level as string | null) ?? null,
    jobType: types.length === 1 ? (types[0] as "internship" | "full_time") : "both",
    locations: r.locations as string[],
    openToRelocate: Boolean(r.open_to_relocate),
    workModes: r.work_modes as string[],
    skills: r.skills as string[],
    avoidKeywords: r.avoid_keywords as string[],
    avoidCompanies: r.avoid_companies as string[],
    companyTypes: r.company_types as string[],
    gradYear: r.grad_year === null ? null : Number(r.grad_year),
    noticePeriod: (r.notice_period as string | null) ?? null,
    minSalaryLpa: r.min_salary_lpa === null ? null : Number(r.min_salary_lpa),
    webhookLast4: hook ? hook.slice(-4) : null,
    minNotifyScore: Number(r.min_notify_score),
    consented: r.ai_consent_at !== null,
    onboarded: r.onboarded_at !== null,
  };
}
