import type { Job } from "./types.js";
import { classify } from "./classify.js";

type HasTitleAndLocation = Pick<Job, "title" | "location">;

const INDIA = /\b(bengaluru|bangalore|india)\b/i;

export const isIndia = (job: HasTitleAndLocation) => INDIA.test(job.location);

// What you're targeting: India + developer + entry level (intern or full-time)
export const passesRules = (job: HasTitleAndLocation) => {
  const c = classify(job.title);
  return isIndia(job) && c.category === "developer" && c.seniority !== "senior";
};