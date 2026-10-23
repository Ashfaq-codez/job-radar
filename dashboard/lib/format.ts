import type { Status } from "./jobs";

export type Fit = { verdict: "apply" | "maybe" | "skip"; reasons: string[]; missing: string[] };
export type Tier = "strong" | "mid" | "low";

export function parseFit(raw: string | null): Fit | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Fit;
  } catch {
    return null;
  }
}

export function tierFor(score: number): Tier {
  if (score >= 80) return "strong";
  if (score >= 50) return "mid";
  return "low";
}

// 0 → red, 50 → orange, 100 → green, blended smoothly in between
export function scoreHue(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score)) * 1.4);
}

export function scoreColor(score: number): { text: string; fill: string } {
  const h = scoreHue(score);
  return { text: `hsl(${h} 45% 38%)`, fill: `hsl(${h} 50% 93%)` };
}

// "acceldata" → "Acceldata", "wunderman-thompson" → "Wunderman Thompson"
export function prettyCompany(slug: string): string {
  if (/^https?:\/\//.test(slug)) return new URL(slug).hostname.replace(/^(www|careers|jobs)\./, "");
  if (/\.wd\d+\//.test(slug)) slug = slug.split(".")[0]!; // Workday "{tenant}.wd5/{site}" → tenant
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(value: Date | string | null): string {
  if (!value) return "—";
  const hours = Math.round((new Date(value).getTime() - Date.now()) / 3_600_000);
  if (Math.abs(hours) < 1) return "just now";
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

export const STATUS_LABEL: Record<Status, string> = {
  new: "To review",
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  hidden: "Hidden",
};

export function boardUrl(source: string, slug: string): string {
  if (source === "lever") return `https://jobs.lever.co/${slug}`;
  if (source === "ashby") return `https://jobs.ashbyhq.com/${slug}`;
  if (source === "careers") return slug; // the careers page itself
  if (source === "workday") {
    const [host, site] = slug.split("/");
    return `https://${host}.myworkdayjobs.com/${site}`;
  }
  return `https://job-boards.greenhouse.io/${slug}`;
}
// Pastel pill per status. Full class names written out: Tailwind only includes classes it can see
export const STATUS_PILL: Record<Status, string> = {
  new: "bg-subtle text-muted",
  saved: "bg-saved-soft text-saved",
  applied: "bg-applied-soft text-applied",
  interviewing: "bg-interview-soft text-interview",
  offer: "bg-offer-soft text-offer",
  rejected: "bg-rejected-soft text-rejected",
  hidden: "bg-subtle text-faint",
};

// The description's experience phrase as a short chip: "0-2 years of experience" → "0–2 yrs".
// Null for "freshers welcome"-style matches, which the Fresher badge already says.
export function experienceLabel(text: string | null): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const n = t.match(/\d+/g);
  if (!n) return null;
  if (/less than|under|up to|upto/.test(t)) return `< ${n[0]} yrs`;
  if (n.length >= 2) return `${n[0]}–${n[1]} yrs`;
  if (/\+|minimum|at least|min/.test(t)) return `${n[0]}+ yrs`;
  return `${n[0]} yrs`;
}

