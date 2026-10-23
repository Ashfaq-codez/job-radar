import { z } from "zod";
import { fetchJson } from "../lib/http.js";
import { htmlToText } from "../lib/text.js";
import type { Job } from "../types.js";

// What Greenhouse sends. Zod checks this at RUNTIME.
const GreenhouseJobSchema = z.object({
  id: z.number(),
  title: z.string(),
  absolute_url: z.string(),
  updated_at: z.string(),
  first_published: z.string().nullish(), // nullish = may be missing or null
  location: z.object({ name: z.string() }),
  content: z.string().nullish(),         // job description (escaped HTML)
});

const GreenhouseResponseSchema = z.object({
  jobs: z.array(GreenhouseJobSchema),
});

export async function fetchGreenhouseJobs(
  company: string,
  opts: { lite?: boolean } = {}
): Promise<Job[]> {
  // lite = skip descriptions (much smaller response), used by discovery
  const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs${opts.lite ? "" : "?content=true"}`;
  const raw = await fetchJson(url, `greenhouse/${company}`);
  const data = GreenhouseResponseSchema.parse(raw); // throws if shape is wrong

  return data.jobs.map((j): Job => ({
    id: `greenhouse:${company}:${j.id}`,
    source: "greenhouse",
    company,
    title: j.title,
    location: j.location.name,
    isRemote: /remote/i.test(j.location.name),
    url: j.absolute_url,
    description: htmlToText(j.content ?? ""),
    postedAt: j.first_published ?? j.updated_at,
  }));
}