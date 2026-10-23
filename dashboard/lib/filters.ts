import { first, type SP } from "./url";

export const TYPES = ["all", "internship", "full_time"] as const;
export const LEVELS = ["all", "fresher"] as const;
export const SCORES = ["any", "50", "80"] as const;
export const SORTS = ["score", "newest"] as const;
export const VIEWS = ["review", "saved"] as const;
export const POSTED = ["any", "1", "7", "30"] as const;

// Location strings vary wildly ("Bengaluru", "Bangalore, IND", "India - Bengaluru"), so match by pattern
export const LOCATIONS = {
  any: { label: "Anywhere", pattern: null },
  blr: { label: "Bengaluru", pattern: "bengaluru|bangalore" },
  hyd: { label: "Hyderabad", pattern: "hyderabad" },
  pune: { label: "Pune", pattern: "pune" },
  ncr: { label: "Delhi NCR", pattern: "gurugram|gurgaon|delhi|noida" },
  mum: { label: "Mumbai", pattern: "mumbai" },
  chn: { label: "Chennai", pattern: "chennai" },
  remote: { label: "Remote", pattern: "remote" },
} as const;
export type LocationKey = keyof typeof LOCATIONS;
const LOCATION_KEYS = Object.keys(LOCATIONS) as LocationKey[];

export interface JobFilters {
  q: string;
  type: (typeof TYPES)[number];
  level: (typeof LEVELS)[number];
  score: (typeof SCORES)[number];
  sort: (typeof SORTS)[number];
  view: (typeof VIEWS)[number];
  loc: LocationKey;
  posted: (typeof POSTED)[number];
  page: number;
}

// URL values are user input: only accept values from the allowed list
function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

export function parseFilters(sp: SP): JobFilters {
  return {
    q: (first(sp, "q") ?? "").trim().slice(0, 100),
    type: pick(first(sp, "type"), TYPES, "all"),
    level: pick(first(sp, "level"), LEVELS, "all"),
    score: pick(first(sp, "score"), SCORES, "any"),
    sort: pick(first(sp, "sort"), SORTS, "score"),
    view: pick(first(sp, "view"), VIEWS, "review"),
    loc: pick(first(sp, "loc"), LOCATION_KEYS, "any"),
    posted: pick(first(sp, "posted"), POSTED, "any"),
    page: Math.max(1, Number.parseInt(first(sp, "page") ?? "1", 10) || 1),
  };
}