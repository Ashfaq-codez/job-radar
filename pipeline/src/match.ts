import { isSeniorTitle, type RoleFamily } from "./classify.js";
import { matchesLocation } from "./location.js";

// The parts of a job matching needs (columns on jobs)
export interface MatchJob {
  title: string;
  company: string;
  location: string;
  is_remote: boolean;
  employment: string | null;
  role_family: RoleFamily | string | null;
  min_years: number | null;
  description?: string | null;
}

// The parts of a profile matching needs (columns on profiles)
export interface MatchProfile {
  role_families: string[];
  extra_titles: string[];
  job_types: string[];
  locations: string[];
  open_to_relocate: boolean;
  max_min_years: number;
  avoid_keywords: string[];
  avoid_companies: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const containsPhrase = (text: string, phrase: string) => {
  const p = norm(phrase);
  return p !== "" && ` ${norm(text)} `.includes(` ${p} `);
};

// Should this job be shown to (and scored for) this person?
export function matchesProfile(job: MatchJob, profile: MatchProfile): boolean {
  const titleWanted =
    (job.role_family !== null && profile.role_families.includes(job.role_family)) ||
    profile.extra_titles.some((t) => containsPhrase(job.title, t));
  if (!titleWanted) return false;

  if (job.employment && profile.job_types.length > 0 && !profile.job_types.includes(job.employment)) return false;
  if (!matchesLocation(job.location, profile.locations, profile.open_to_relocate, job.is_remote)) return false;
  if (job.min_years !== null && job.min_years > profile.max_min_years) return false;
  if (isSeniorTitle(job.title)) return false;

  const text = `${job.title} ${job.description ?? ""}`;
  if (profile.avoid_keywords.some((k) => containsPhrase(text, k))) return false;
  if (profile.avoid_companies.some((c) => containsPhrase(job.company, c) || norm(job.company).replace(/ /g, "") === norm(c).replace(/ /g, ""))) return false;
  return true;
}
