import { z } from "zod";
import { fetchJson } from "../lib/http.js";
import type { Job } from "../types.js";

const LeverPostingSchema = z.object({
  id: z.string(),
  text: z.string(),                       // Lever calls the title "text"
  hostedUrl: z.string(),
  workplaceType: z.string().optional(),
   descriptionPlain: z.string().nullish(),
  createdAt: z.number().optional(),       // milliseconds since 1970
  categories: z.object({
    location: z.string().optional(),
  }),
});

const LeverResponseSchema = z.array(LeverPostingSchema); // plain array, no { jobs }

export async function fetchLeverJobs(company: string): Promise<Job[]> {
  const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
  const postings = LeverResponseSchema.parse(await fetchJson(url, `lever/${company}`));

  return postings.map((p): Job => ({
    id: `lever:${company}:${p.id}`,
    source: "lever",
    company,
    title: p.text,
    location: p.categories.location ?? "Unknown",
    isRemote: p.workplaceType === "remote",
    url: p.hostedUrl,
    description: p.descriptionPlain ?? "",
    postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
  }));
}