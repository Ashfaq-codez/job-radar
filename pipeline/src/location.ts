// Indian cities and their common spellings. The keys are the choices people pick in onboarding.
export const CITY_ALIASES: Record<string, string[]> = {
  Bengaluru: ["bengaluru", "bangalore", "blr"],
  Hyderabad: ["hyderabad", "secunderabad"],
  Pune: ["pune"],
  Chennai: ["chennai", "madras"],
  Mumbai: ["mumbai", "navi mumbai", "thane", "bombay"],
  "Delhi NCR": ["delhi", "new delhi", "gurugram", "gurgaon", "noida", "greater noida", "ncr", "faridabad", "ghaziabad"],
  Kolkata: ["kolkata", "calcutta"],
  Ahmedabad: ["ahmedabad"],
  Kochi: ["kochi", "cochin"],
};
export const REMOTE_INDIA = "Remote India";

const words = (list: string[]) => new RegExp(`\\b(${list.map((w) => w.replace(/\s+/g, "\\s+")).join("|")})\\b`, "i");
const CITY_RE = Object.fromEntries(Object.entries(CITY_ALIASES).map(([city, aliases]) => [city, words(aliases)]));
const ANY_CITY = words(Object.values(CITY_ALIASES).flat());
const INDIA = /\bindia\b/i;
const REMOTE = /\b(remote|work from home|wfh)\b/i;

export function isIndiaLocation(location: string): boolean {
  return INDIA.test(location) || ANY_CITY.test(location);
}

// Does a job's location suit someone's chosen cities?
// - Not in India: never.
// - Open to relocate, or no cities chosen: anywhere in India.
// - "Remote India" chosen: remote jobs in India match.
// - Location says only "India" (no city, e.g. "2 Locations (India)"): matches, since it may include their city.
export function matchesLocation(
  jobLocation: string,
  profileLocations: string[],
  openToRelocate: boolean,
  isRemote = false
): boolean {
  if (!isIndiaLocation(jobLocation)) return false;
  if (openToRelocate || profileLocations.length === 0) return true;

  const remote = isRemote || REMOTE.test(jobLocation);
  if (remote && profileLocations.includes(REMOTE_INDIA)) return true;

  const cities = profileLocations.filter((l) => CITY_RE[l]);
  if (cities.some((c) => CITY_RE[c]!.test(jobLocation))) return true;
  return !ANY_CITY.test(jobLocation) && !remote; // just "India": could be anywhere
}
