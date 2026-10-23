import { z } from "zod";
import { cleanHtml } from "../lib/text.js";
import { fetchJson } from "../lib/http.js";
import type { Job } from "../types.js";

const LeverPostingSchema = z.object({
  id: z.string(),
  text: z.string(),                       // Lever calls the title "text"
  hostedUrl: z.string(),
  workplaceType: z.string().optional(),
  descriptionPlain: z.string().nullish(),
  description: z.string().nullish(),     // intro, HTML
  lists: z.array(z.object({ text: z.string(), content: z.string() })).nullish(), // titled sections, HTML items
  additional: z.string().nullish(),      // closing notes, HTML
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
    // Lever splits the posting into parts; stitch them back in the order the job page shows them
    descriptionHtml: cleanHtml(
      [p.description ?? "", ...(p.lists ?? []).map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`), p.additional ?? ""].join("")
    ),
    postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
  }));
}