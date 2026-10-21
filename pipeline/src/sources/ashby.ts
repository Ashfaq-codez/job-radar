import { z } from "zod";
import { fetchJson } from "../lib/http.js";
import type { Job } from "../types.js";

const AshbyJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string(),
  isRemote: z.boolean().nullish(),
  jobUrl: z.string(),
  publishedAt: z.string().nullish(),
});

const AshbyResponseSchema = z.object({
  jobs: z.array(AshbyJobSchema),
});

export async function fetchAshbyJobs(company: string): Promise<Job[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${company}`;
  const data = AshbyResponseSchema.parse(await fetchJson(url, `ashby/${company}`));

  return data.jobs.map((j): Job => ({
    id: `ashby:${company}:${j.id}`,
    source: "ashby",
    company,
    title: j.title,
    location: j.location,
    isRemote: j.isRemote ?? false,
    url: j.jobUrl,
    postedAt: j.publishedAt ?? null,
  }));
}