export type Category = "developer" | "other";
export type Employment = "internship" | "full_time";
export type Seniority = "fresher" | "entry" | "senior";
export const ROLE_FAMILIES = [
  "software_dev", "data_analyst", "data_scientist", "data_engineer",
  "ml_ai", "business_analyst", "qa_testing", "devops_cloud",
] as const;
export type RoleFamily = (typeof ROLE_FAMILIES)[number] | "other";

export interface Classification {
  category: Category;
  employment: Employment;
  seniority: Seniority;
  roleFamily: RoleFamily;
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

// ── Role families ──
// Checked in order: the more specific families first, so "Data Engineer" isn't software_dev
// and "SDET" is qa_testing. Analyst titles in sales/finance/security are "other" on purpose:
// "Sales Analyst", "Financial Analyst", "Credit Analyst", "SOC Analyst" aren't data or BA roles.
const FAMILY_TITLES: [RoleFamily, RegExp][] = [
  ["qa_testing", /\b(qa|quality assurance|sdet|tester|testing|test engineer|test automation|automation test(ing|er)?|software engineer in test)\b/i],
  ["devops_cloud", /\b(devops|dev ops|sre|site reliability|cloud engineer|cloud ops|cloud support|platform engineer|infrastructure engineer|devsecops|kubernetes|aws engineer|azure engineer)\b/i],
  ["data_engineer", /\b(data engineer(ing)?|etl|big data|data platform|analytics engineer|data pipeline|data warehouse)\b/i],
  ["ml_ai", /\b(machine learning|ml engineer|mlops|ai engineer|ai\/ml|ml\/ai|deep learning|nlp|computer vision|llm|gen ?ai|generative ai|applied scientist|ai developer|ai research)\b/i],
  ["data_scientist", /\b(data scientist|data science)\b/i],
  ["data_analyst", /\b(data analyst|data analytics|bi analyst|bi developer|business intelligence|mis (analyst|executive)|mis\b|reporting analyst|analytics (intern|associate|analyst|trainee)|product analyst|power bi|tableau|insights analyst)\b/i],
  ["business_analyst", /\b(business analyst|business systems analyst|functional analyst|business analysis)\b/i],
];

// Analyst titles that are never data/BA roles, even with a family word nearby
const NOT_DATA_ANALYST = /\b(sales|financial|finance|credit|security|soc|cyber|risk|equity|investment|research analyst|kyc|aml|fraud|tax|audit)\b/i;

// Strong data words keep "Data Analyst, Finance" a data role
const DATA_WORDS = /\b(data|bi|mis|business intelligence|power bi|tableau)\b/i;
// Non-tech engineering, never placed from the description
const NOT_TECH = /\b(mechanical|electrical|civil|hardware|asic|rtl|analog|vlsi|silicon|manufacturing|structural|designer|product manager|program manager|project manager|consultant|sales|marketing)\b/i;

// A title too vague to place ("Graduate Trainee", "Associate", "Analyst"): read the description
const GENERIC_TITLE = /\b(trainee|graduate|intern|internship|associate|analyst|engineer|developer|fresher)\b/i;
const FAMILY_HINTS: [RoleFamily, RegExp][] = [
  ["data_analyst", /\b(sql|excel|power bi|tableau|dashboards?|reporting|data analysis)\b/gi],
  ["data_scientist", /\b(statistic(s|al)|predictive model(s|ling)?|data science|hypothesis)\b/gi],
  ["data_engineer", /\b(etl|spark|airflow|data pipelines?|data warehouse|dbt)\b/gi],
  ["ml_ai", /\b(machine learning|deep learning|pytorch|tensorflow|llms?|nlp)\b/gi],
  ["qa_testing", /\b(test cases|selenium|manual testing|test automation|regression testing)\b/gi],
  ["devops_cloud", /\b(ci\/cd|terraform|kubernetes|docker|jenkins|aws|azure|gcp)\b/gi],
  ["business_analyst", /\b(requirements gathering|brd|user stories|stakeholders?|process mapping)\b/gi],
  ["software_dev", /\b(java|javascript|typescript|react|node\.?js|python|golang|spring boot|rest apis?|backend|frontend)\b/gi],
];
const MIN_HINTS = 3; // need a few mentions before trusting the description

function familyFromDescription(description: string): RoleFamily {
  let best: RoleFamily = "other";
  let bestHits = MIN_HINTS - 1;
  for (const [family, re] of FAMILY_HINTS) {
    const hits = description.match(re)?.length ?? 0;
    if (hits > bestHits) [best, bestHits] = [family, hits];
  }
  return best;
}

export function roleFamily(title: string, description = "", isDev = false): RoleFamily {
  if (ALWAYS_OUT.test(title)) return "other";
  for (const [family, re] of FAMILY_TITLES) {
    if (!re.test(title)) continue;
    if (family === "data_analyst" && NOT_DATA_ANALYST.test(title) && !DATA_WORDS.test(title)) return "other";
    if (family === "business_analyst" && NOT_DATA_ANALYST.test(title)) return "other";
    return family;
  }
  if (/\banalyst\b/i.test(title) && NOT_DATA_ANALYST.test(title)) return "other";
  if (isDev) return "software_dev";
  return description && GENERIC_TITLE.test(title) && !NOT_TECH.test(title)
    ? familyFromDescription(description)
    : "other";
}

// Senior words in the title alone (used for matching, where years are checked separately)
export const isSeniorTitle = (title: string) => TOO_SENIOR.test(title);

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
    roleFamily: roleFamily(title, description, isDev),
    minYears: exp?.minYears ?? null,
    experienceText: exp?.text ?? null,
  };
}
