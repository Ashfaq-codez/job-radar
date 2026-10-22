import type { Job } from "./types.js";

// Only needs these two fields, so it works for Job AND JobToScore
type HasTitleAndLocation = Pick<Job, "title" | "location">;

const INDIA = /\b(bengaluru|bangalore|india)\b/i;
const TOO_SENIOR =
  /\b(senior|sr\.?|staff|principal|lead|manager|director|head|architect|vp|ii|iii|iv)\b|\bsde[\s-]?[23]\b/i;

export const isIndia = (job: HasTitleAndLocation) => INDIA.test(job.location);
export const isEntryLevel = (job: HasTitleAndLocation) => !TOO_SENIOR.test(job.title);
export const passesRules = (job: HasTitleAndLocation) => isIndia(job) && isEntryLevel(job);