export type Category = "developer" | "other";
export type Employment = "internship" | "full_time";
export type Seniority = "fresher" | "entry" | "senior";

export interface Classification {
  category: Category;
  employment: Employment;
  seniority: Seniority;
  minYears: number | null;       // lowest years of experience the description asks for
  experienceText: string | null; // the phrase it came from, e.g. "0-2 years"
}

// A role asking for at most this many years still counts as a fresher role
export const FRESHER_MAX_MIN_YEARS = 1;

// Titles that are clearly software development (incl. backend stack words)
const DEV =
  /\b(software|developer|programmer|sde|swe|sdet|backend|back-end|back end|frontend|front-end|full[\s-]?stack|web|mobile|android|ios|flutter|java|python|golang|node\.?js|django|spring boot|api|devops|sre|site reliability|platform|cloud|data engineer|ml engineer|machine learning engineer|ai engineer|member of technical staff|mts|test automation)\b/i;

// Never developer roles, even if "software" appears (e.g. "Software Sales Executive")
const ALWAYS_OUT =
  /\b(sales|recruiter|recruiting|talent|marketing|account executive|account manager|customer success)\b/i;

// Plain "Engineer" titles that are NOT software
const NOT_SOFTWARE_ENGINEER =
  /\b(solutions?|pre-?sales|support|customer|field|mechanical|electrical|civil|hardware|asic|rtl|analog|physical design|dft|vlsi|verification|silicon|manufacturing|process|network|structural|quality|qa|product manager|program manager|project manager|designer|analyst|consultant)\b/i;

const GENERIC_ENGINEER = /\bengineer(ing)?\b/i;

// Internships (note: "Trainee" is NOT here; in India it's usually a full-time fresher role)
const INTERN = /\b(intern|internship|apprentice|co-?op)\b/i;

// Titles explicitly aimed at new grads
const FRESHER =
  /\b(fresher|freshers|new grad|new graduate|graduate|campus|junior|jr\.?|associate|trainee|entry[\s-]?level|early career|(sde|swe|engineer)[\s-]?(1|i))\b/i;

// Checked BEFORE fresher, so "Senior Associate" counts as senior
const TOO_SENIOR =
  /\b(senior|sr\.?|staff|principal|lead|manager|director|head|architect|vp|ii|iii|iv)\b|\b(sde|swe)[\s-]?[23]\b/i;

// ── Experience from the job description ──
const UNIT = String.raw`(?:years?|yrs?)\b`;
const N = String.raw`(\d{1,2})`;
// [pattern, how to read the minimum from the match]; each needs "experience" nearby to count
const YEAR_PATTERNS: [RegExp, (m: RegExpExecArray) => number][] = [
  [new RegExp(String.raw`\b(?:less than|under|up to|upto)\s+${N}\s*${UNIT}`, "gi"), () => 0],
  [new RegExp(String.raw`\b${N}\s*(?:-|to)\s*${N}\s*\+?\s*${UNIT}`, "gi"), (m) => Number(m[1])],
  [new RegExp(String.raw`\b(?:minimum(?:\s+of)?|at least|min\.?)\s+${N}\s*\+?\s*${UNIT}`, "gi"), (m) => Number(m[1])],
  [new RegExp(String.raw`\b${N}\s*\+\s*${UNIT}`, "gi"), (m) => Number(m[1])],
  [new RegExp(String.raw`\b${N}\s*${UNIT}`, "gi"), (m) => Number(m[1])],
];
const EXPERIENCE_WORD = /\b(?:exp|experience|experienced)\b/i;
const NO_EXPERIENCE = /\b(?:freshers?|new grads?|no experience required)\b/i;
const CONTEXT_CHARS = 60;
const MAX_YEARS = 15;

export function extractExperience(text: string): { minYears: number; text: string } | null {
  const t = text.replace(/[\u2010-\u2015]/g, "-"); // en/em dashes → "-" (same length, so indexes still match)
  let best: { minYears: number; text: string } | null = null;

  for (const [re, minOf] of YEAR_PATTERNS) {
    for (const m of t.matchAll(re)) {
      const numbers = m.slice(1).filter(Boolean).map(Number);
      if (numbers.some((n) => n > MAX_YEARS)) continue; // "founded 20 years ago", "25 years old"
      const around = t.slice(Math.max(0, m.index - CONTEXT_CHARS), m.index + m[0].length + CONTEXT_CHARS);
      if (!EXPERIENCE_WORD.test(around)) continue;
      const min = minOf(m as RegExpExecArray);
      if (!best || min < best.minYears) best = { minYears: min, text: m[0].trim() };
    }
  }

  const fresher = t.match(NO_EXPERIENCE);
  if (fresher && (!best || best.minYears > 0)) best = { minYears: 0, text: fresher[0] };
  return best;
}

export function classify(title: string, description = ""): Classification {
  const isDev =
    !ALWAYS_OUT.test(title) &&
    (DEV.test(title) || (GENERIC_ENGINEER.test(title) && !NOT_SOFTWARE_ENGINEER.test(title)));

  // Senior title words win; then the description's years; then fresher title words
  const exp = extractExperience(description);
  const seniority: Seniority = TOO_SENIOR.test(title)
    ? "senior"
    : exp
      ? exp.minYears <= FRESHER_MAX_MIN_YEARS ? "fresher" : "senior"
      : FRESHER.test(title)
        ? "fresher"
        : "entry";

  return {
    category: isDev ? "developer" : "other",
    employment: INTERN.test(title) ? "internship" : "full_time",
    seniority,
    minYears: exp?.minYears ?? null,
    experienceText: exp?.text ?? null,
  };
}
