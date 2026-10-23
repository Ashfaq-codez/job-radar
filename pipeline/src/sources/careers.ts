import { createHash } from "node:crypto";
import { z } from "zod";
import { jobLinks, parseJsonLdJobs } from "../lib/jsonld.js";
import { mapWithLimit } from "../lib/pool.js";
import { robotsAllows } from "../lib/robots.js";
import { safeFetch } from "../lib/safe-fetch.js";
import { cleanHtml, htmlToText } from "../lib/text.js";
import type { Job } from "../types.js";

// A plain careers page with schema.org JobPosting data (JSON-LD), added from the dashboard.
// The slug IS the careers page URL.

const Text = z.string().trim().min(1);
const Country = z.union([Text, z.object({ name: Text })]).transform((c) => (typeof c === "string" ? c : c.name));
const Address = z.union([
  Text,
  z.object({ addressLocality: Text.optional(), addressRegion: Text.optional(), addressCountry: Country.optional() }),
]);
const Place = z.object({ address: Address.optional() });

// Lenient on purpose: anything we can't read is dropped instead of failing the posting
const JobPostingSchema = z.object({
  title: Text,
  url: z.url().optional().catch(undefined),
  datePosted: z.string().optional().catch(undefined),
  description: z.string().optional().catch(undefined),
  hiringOrganization: z.union([Text, z.object({ name: Text })]).optional().catch(undefined),
  jobLocation: z.union([Place, z.array(Place)]).optional().catch(undefined),
  jobLocationType: z.string().optional().catch(undefined),
});
type Posting = z.infer<typeof JobPostingSchema>;

const COUNTRY_NAMES: Record<string, string> = { IN: "India", IND: "India", US: "United States", GB: "United Kingdom" };

export function locationOf(p: Posting): string {
  const places = p.jobLocation === undefined ? [] : Array.isArray(p.jobLocation) ? p.jobLocation : [p.jobLocation];
  const parts = places
    .map(({ address: a }) => {
      if (!a) return "";
      if (typeof a === "string") return a;
      const country = a.addressCountry && (COUNTRY_NAMES[a.addressCountry.toUpperCase()] ?? a.addressCountry);
      return [a.addressLocality, a.addressRegion, country].filter(Boolean).join(", ");
    })
    .filter(Boolean);
  if (parts.length) return [...new Set(parts)].join("; ");
  return p.jobLocationType === "TELECOMMUTE" ? "Remote" : "Unknown";
}

export function toJob(raw: unknown, pageUrl: string): Job | null {
  const parsed = JobPostingSchema.safeParse(raw);
  if (!parsed.success) return null; // malformed posting: skip it, keep the rest of the site
  const p = parsed.data;
  const url = p.url ?? pageUrl;
  const host = new URL(pageUrl).hostname.replace(/^www\./, "");
  const org = typeof p.hiringOrganization === "string" ? p.hiringOrganization : p.hiringOrganization?.name;
  const posted = p.datePosted ? new Date(p.datePosted) : null;
  const html = p.description ?? "";

  return {
    // Hash of URL + title: stable across runs, and unique even when one page lists several roles
    id: `careers:${host}:${createHash("sha1").update(`${url}\n${p.title}`).digest("hex").slice(0, 12)}`,
    source: "careers",
    company: org ?? host,
    title: p.title,
    location: locationOf(p),
    isRemote: p.jobLocationType === "TELECOMMUTE",
    url,
    description: htmlToText(html),
    descriptionHtml: cleanHtml(html),
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted.toISOString() : null,
  };
}

export async function fetchCareersJobs(careersUrl: string): Promise<Job[]> {
  const origin = new URL(careersUrl).origin;
  const robots = await safeFetch(`${origin}/robots.txt`).catch(() => null);
  const allowed = (u: string) => !robots || robots.status !== 200 || robotsAllows(robots.text, new URL(u).pathname + new URL(u).search);
  if (!allowed(careersUrl)) throw new Error(`careers/${origin}: robots.txt disallows ${careersUrl}`);

  const page = await safeFetch(careersUrl);
  if (page.status >= 400) throw new Error(`careers/${origin}: page answered ${page.status}`);
  const pages: { url: string; html: string }[] = [{ url: page.url, html: page.text }];

  // Listing page without data: follow up to 30 same-site job links, 3 at a time
  if (parseJsonLdJobs(page.text).length === 0) {
    const links = jobLinks(page.text, page.url, 30).filter(allowed);
    const results = await mapWithLimit(links, 3, (l) => safeFetch(l));
    for (const r of results) if (r.status === "fulfilled") pages.push({ url: r.value.url, html: r.value.text });
  }

  const jobs = pages.flatMap(({ url, html }) => parseJsonLdJobs(html).map((raw) => toJob(raw, url)));
  return [...new Map(jobs.filter((j): j is Job => j !== null).map((j) => [j.id, j])).values()];
}
