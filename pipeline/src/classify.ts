export type Category = "developer" | "other";
export type Employment = "internship" | "full_time";
export type Seniority = "fresher" | "entry" | "senior";

export interface Classification {
  category: Category;
  employment: Employment;
  seniority: Seniority;
}

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

export function classify(title: string): Classification {
  const isDev =
    !ALWAYS_OUT.test(title) &&
    (DEV.test(title) || (GENERIC_ENGINEER.test(title) && !NOT_SOFTWARE_ENGINEER.test(title)));

  const seniority: Seniority = TOO_SENIOR.test(title)
    ? "senior"
    : FRESHER.test(title)
      ? "fresher"
      : "entry";

  return {
    category: isDev ? "developer" : "other",
    employment: INTERN.test(title) ? "internship" : "full_time",
    seniority,
  };
}