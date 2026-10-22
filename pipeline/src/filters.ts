import type { Job } from "./types.js";

const INDIA = /\b(bengaluru|bangalore|india)\b/i;
const TOO_SENIOR =
  /\b(senior|sr\.?|staff|principal|lead|manager|director|head|architect|vp|ii|iii|iv)\b|\bsde[\s-]?[23]\b/i;

export const isIndia = (job: Job) => INDIA.test(job.location);
export const isEntryLevel = (job: Job) => !TOO_SENIOR.test(job.title);
export const passesRules = (job: Job) => isIndia(job) && isEntryLevel(job);