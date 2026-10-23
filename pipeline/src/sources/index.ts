import { fetchGreenhouseJobs } from "./greenhouse.js";
import { fetchLeverJobs } from "./lever.js";
import { fetchAshbyJobs } from "./ashby.js";
import type { Job, Source } from "../types.js";

export type Fetcher = (company: string, opts?: { lite?: boolean }) => Promise<Job[]>;

export const fetchers: Record<Source, Fetcher> = {
  greenhouse: fetchGreenhouseJobs,
  lever: fetchLeverJobs, // ignores opts; Lever has no lite mode
  ashby: fetchAshbyJobs,
};