import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import type { JobToScore } from "../db/jobs.js";

const MODEL = "gpt-5.4-nano";          // change to "gpt-5.4-mini" for better judgment
const PRICE_IN = 0.2 / 1_000_000;      // $ per input token (nano)
const PRICE_OUT = 1.25 / 1_000_000;    // $ per output token (nano)
const MAX_DESC_CHARS = 6000;           // ~1,500 tokens; long JDs get trimmed

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is missing. Add it to pipeline/.env");
}
const openai = new OpenAI(); // reads OPENAI_API_KEY automatically

// The exact shape the AI must return. Same Zod you used for APIs.
export const FitSchema = z.object({
  score: z.number(),
  verdict: z.enum(["apply", "maybe", "skip"]),
  reasons: z.array(z.string()),
  missing: z.array(z.string()),
});
export type Fit = z.infer<typeof FitSchema>;

const INSTRUCTIONS = `You screen jobs for one candidate: a 2025 Computer Science graduate in Bengaluru looking for an entry-level software developer role or a software internship (0-1 years of experience). Internships and full-time roles are both welcome, at startups or established companies.

Compare the job with the candidate's resume and return:
- score: 0-100. 80+ = strong match, apply today. 50-79 = worth applying. Below 50 = poor fit.
- verdict: "apply", "maybe" or "skip".
- reasons: 2-4 short points explaining the score, naming specific resume items.
- missing: requirements the job asks for that the resume does not show (empty if none).

Rules:
- If the job requires 2+ years of experience, score below 40.
- If the job is not in India and not remote-friendly for India, score below 30.
- Judge only from the resume. Never assume skills it doesn't show.`;

let resumeCache: string | null = null;

async function loadResume(): Promise<string> {
  if (resumeCache) return resumeCache;
  // Path relative to THIS file: src/scoring → pipeline/data/resume.md
  const path = new URL("../../data/resume.md", import.meta.url);
  resumeCache = await readFile(path, "utf8");
  return resumeCache;
}

export async function scoreJob(job: JobToScore): Promise<{ fit: Fit; cost: number }> {
  const resume = await loadResume();

  const response = await openai.responses.parse({
    model: MODEL,
    reasoning: { effort: "low" },
    input: [
      // Same text every call → put it FIRST so OpenAI can cache it
      { role: "system", content: `${INSTRUCTIONS}\n\nCANDIDATE RESUME:\n${resume}` },
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