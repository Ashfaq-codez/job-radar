import type { Job } from "./types.js";
import { classify } from "./classify.js";
import { isIndiaLocation } from "./location.js";

type HasTitleAndLocation = Pick<Job, "title" | "location">;

export const isIndia = (job: Pick<Job, "location">) => isIndiaLocation(job.location);

// Worth listing in the run log: India + a role family someone could want + not senior
export const passesRules = (job: HasTitleAndLocation) => {
  const c = classify(job.title);
  return isIndia(job) && c.roleFamily !== "other" && c.seniority !== "senior";
};
