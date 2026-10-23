import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { EXPERIENCE_LEVELS, ROLE_FAMILIES } from "./profile-options";

// Same model as the pipeline's scorer (pipeline/src/scoring/score.ts). Keep the two in sync.
export const MODEL = "gpt-5.4-nano";

const levels = EXPERIENCE_LEVELS.map((l) => l.value) as [string, ...string[]];
const families = ROLE_FAMILIES.map((f) => f.value) as [string, ...string[]];

// What the AI pre-fills in onboarding. Everything is editable afterwards.
const ResumeSuggestions = z.object({
  skills: z.array(z.string()),
  grad_year: z.number().int().nullable(),
  experience_level: z.enum(levels),
  role_families: z.array(z.enum(families)),
  extra_titles: z.array(z.string()),
});

const INSTRUCTIONS = `You read a resume for an early-career job seeker in India and suggest profile settings.
- skills: up to 20 concrete technical skills or tools the resume shows (e.g. "Python", "SQL", "React"). No soft skills.
- grad_year: year of their most recent degree (or expected graduation), or null if not stated.
- experience_level: "fresher" if no full-time work yet (internships don't count), "lt1" (<1 year), "1-2", "2-3" or "3plus".
- role_families: 1-3 that fit best, from: ${families.join(", ")}.
- extra_titles: up to 5 specific job titles they'd search for that the families might miss (e.g. "Salesforce Developer"). Can be empty.`;

export type Suggestions = { skills: string[]; gradYear: number | null; level: string | null; families: string[]; titles: string[] };

// One call per upload. Returns null (never throws) so onboarding still works if the AI is down.
export async function suggestFromResume(resume: string): Promise<Suggestions | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const openai = new OpenAI();
    const res = await openai.responses.parse({
      model: MODEL,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: INSTRUCTIONS },
        { role: "user", content: resume.slice(0, 15_000) },
      ],
      text: { format: zodTextFormat(ResumeSuggestions, "resume_suggestions") },
    });
    const s = res.output_parsed;
    if (!s) return null;
    const year = new Date().getFullYear();
    return {
      skills: [...new Set(s.skills.map((x) => x.trim().slice(0, 60)).filter(Boolean))].slice(0, 20),
      gradYear: s.grad_year && s.grad_year >= 1990 && s.grad_year <= year + 5 ? s.grad_year : null,
      level: s.experience_level,
      families: [...new Set(s.role_families)].slice(0, 3),
      titles: [...new Set(s.extra_titles.map((x) => x.trim().slice(0, 60)).filter(Boolean))].slice(0, 5),
    };
  } catch (err) {
    // Only the error type: the message could quote resume text
    console.error("Resume suggestions failed:", err instanceof Error ? err.name : "unknown error");
    return null;
  }
}
