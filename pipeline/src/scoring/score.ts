import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { JobToScore } from "../db/jobs.js";
import { FitSchema, type Fit } from "./fit.js";

export { FitSchema, type Fit };

export const MODEL = "gpt-5.4-nano";   // change to "gpt-5.4-mini" for better judgment (the dashboard copies this)
const PRICE_IN = 0.2 / 1_000_000;      // $ per input token (nano)
const PRICE_OUT = 1.25 / 1_000_000;    // $ per output token (nano)
const MAX_DESC_CHARS = 6000;           // ~1,500 tokens; long JDs get trimmed
const MAX_RESUME_CHARS = 15000;

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is missing. Add it to pipeline/.env");
}
const openai = new OpenAI(); // reads OPENAI_API_KEY automatically

const INSTRUCTIONS = `You screen jobs for one candidate in India who is early in their career. Their preferences and resume follow.

Compare the job with the candidate's resume and preferences and return:
- score: 0-100. 80+ = strong match, apply today. 50-79 = worth applying. Below 50 = poor fit.
- verdict: "apply", "maybe" or "skip".
- reasons: 2-4 short points explaining the score, naming specific resume items.
- missing: requirements the job asks for that the resume does not show (empty if none).

Rules:
- If the job requires more years of experience than the candidate's maximum, score below 40.
- If the job is not in the candidate's locations (or India-remote when they accept remote), score below 30.
- Prefer roles in the candidate's target role families and titles.
- Judge only from the resume. Never assume skills it doesn't show.`;

// The candidate as the AI sees them: preferences + resume. No name or email.
export interface Candidate {
  resume: string;
  preferences: string;
}

const LEVEL_LABEL: Record<string, string> = {
  fresher: "Fresher", lt1: "Less than 1 year", "1-2": "1-2 years", "2-3": "2-3 years", "3plus": "3+ years",
};

export function describePreferences(p: {
  role_families: string[]; extra_titles: string[]; experience_level: string | null; max_min_years: number;
  job_types: string[]; locations: string[]; open_to_relocate: boolean; work_modes: string[]; skills: string[];
  company_types: string[]; grad_year: number | null; notice_period: string | null; min_salary_lpa: string | null;
}): string {
  const list = (xs: string[]) => (xs.length ? xs.join(", ") : "any");
  return [
    `Target role families: ${list(p.role_families.map((f) => f.replace(/_/g, " ")))}`,
    p.extra_titles.length ? `Also interested in titles: ${p.extra_titles.join(", ")}` : null,
    `Experience: ${LEVEL_LABEL[p.experience_level ?? ""] ?? "not given"} (accepts jobs asking for at most ${p.max_min_years} years)`,
    `Job types: ${list(p.job_types.map((t) => (t === "full_time" ? "full-time" : t)))}`,
    `Locations: ${list(p.locations)}${p.open_to_relocate ? " (open to relocating within India)" : ""}`,
    p.work_modes.length ? `Work modes: ${p.work_modes.join(", ")}` : null,
    p.skills.length ? `Skills: ${p.skills.join(", ")}` : null,
    p.company_types.length ? `Company types: ${p.company_types.join(", ")}` : null,
    p.grad_year ? `Graduation year: ${p.grad_year}` : null,
    p.notice_period ? `Notice period: ${p.notice_period}` : null,
    p.min_salary_lpa ? `Minimum salary: ${p.min_salary_lpa} LPA` : null,
  ].filter(Boolean).join("\n");
}

export async function scoreJob(job: JobToScore, candidate: Candidate): Promise<{ fit: Fit; cost: number }> {

  const response = await openai.responses.parse({
    model: MODEL,
    reasoning: { effort: "low" },
    input: [
      // Same text for every job of this person → put it FIRST so OpenAI can cache it
      {
        role: "system",
        content: `${INSTRUCTIONS}\n\nCANDIDATE PREFERENCES:\n${candidate.preferences}\n\nCANDIDATE RESUME:\n${candidate.resume.slice(0, MAX_RESUME_CHARS)}`,
      },
      // Changes every call → put it LAST
      {
        role: "user",
        content: `JOB: ${job.title} at ${job.company} (${job.location})\n\n${job.description.slice(0, MAX_DESC_CHARS)}`,
      },
    ],
    text: { format: zodTextFormat(FitSchema, "job_fit") },
  });

  const fit = response.output_parsed;
  if (!fit) throw new Error(`No score returned for ${job.company} | ${job.title}`);

  const usage = response.usage;
  const cost = usage ? usage.input_tokens * PRICE_IN + usage.output_tokens * PRICE_OUT : 0;
  const score = Math.max(0, Math.min(100, Math.round(fit.score))); // keep it 0-100

  return { fit: { ...fit, score }, cost };
}