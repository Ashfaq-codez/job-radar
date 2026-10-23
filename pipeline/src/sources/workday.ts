import { z } from "zod";
import { classify } from "../classify.js";
import { mapWithLimit } from "../lib/pool.js";
import { USER_AGENT } from "../lib/safe-fetch.js";
import { cleanHtml, htmlToText } from "../lib/text.js";
import type { Job } from "../types.js";

// Workday career sites. The slug is "{tenant}.wd{N}/{site}", e.g. "nvidia.wd5/NVIDIAExternalCareerSite".
// We ask Workday for India jobs only (via its location facets), page 20 at a time,
// and fetch full descriptions only for the roles we'd actually score.

type Facet = { facetParameter?: string | undefined; descriptor?: string | undefined; id?: string | undefined; values?: Facet[] | undefined };
const FacetSchema: z.ZodType<Facet> = z.lazy(() =>
  z.object({
    facetParameter: z.string().optional(),
    descriptor: z.string().optional(),
    id: z.string().optional(),
    values: z.array(FacetSchema).optional(),
  })
);

const ListSchema = z.object({
  total: z.number().optional(),
  facets: z.array(FacetSchema).optional(),
  jobPostings: z.array(
    z.object({
      title: z.string(),
      externalPath: z.string(),           // "/job/Bengaluru/Software-Engineer_JR123"
      locationsText: z.string().nullish(), // "Bengaluru, India" or "3 Locations"
      postedOn: z.string().nullish(),      // "Posted 3 Days Ago"
    })
  ),
});

const DetailSchema = z.object({
  jobPostingInfo: z.object({
    jobDescription: z.string().nullish(),
    remoteType: z.string().nullish(),
  }),
});

const PAGE_SIZE = 20; // Workday rejects larger pages
const MAX_PAGES = 25;
const INDIA = /india|bengaluru|bangalore|karnataka/i;

type AppliedFacets = Record<string, string[]>;

// Walk nested facets (group → country → values), collecting India value ids under their facetParameter.
// Prefer a country-level parameter; otherwise use the one with the most matches.
export function indiaFacets(facets: Facet[]): AppliedFacets | null {
  const found: AppliedFacets = {};
  const walk = (list: Facet[], param: string | undefined) => {
    for (const f of list) {
      const p = f.facetParameter ?? param;
      if (p && f.id && f.descriptor && INDIA.test(f.descriptor)) (found[p] ??= []).push(f.id);
      if (f.values) walk(f.values, p);
    }
  };
  walk(facets, undefined);

  const params = Object.keys(found);
  if (params.length === 0) return null;
  const best =
    params.find((p) => /country/i.test(p)) ?? params.sort((a, b) => found[b]!.length - found[a]!.length)[0]!;
  return { [best]: found[best]! };
}

// "Posted Today" / "Posted Yesterday" / "Posted 3 Days Ago" / "Posted 30+ Days Ago" → ISO date
export function parsePostedOn(text: string | null | undefined, now = new Date()): string | null {
  if (!text) return null;
  const days = /today/i.test(text) ? 0 : /yesterday/i.test(text) ? 1 : Number(text.match(/(\d+)\+?\s*days?\s*ago/i)?.[1] ?? NaN);
  if (Number.isNaN(days)) return null;
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

async function call(url: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`workday ${url} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchWorkdayJobs(slug: string, opts: { lite?: boolean } = {}): Promise<Job[]> {
  const [host, site] = slug.split("/");
  const tenant = host?.split(".")[0];
  if (!host || !site || !tenant || !/\.wd\d+$/.test(host)) throw new Error(`workday/${slug}: slug must look like "tenant.wd5/Site"`);
  const base = `https://${host}.myworkdayjobs.com`;
  const api = `${base}/wday/cxs/${tenant}/${site}`;
  const list = (offset: number, appliedFacets: AppliedFacets) =>
    call(`${api}/jobs`, { appliedFacets, limit: PAGE_SIZE, offset, searchText: "" }).then((r) => ListSchema.parse(r));

  // 1. The first unfiltered page tells us the facets; filter to India if Workday offers a facet for it
  const probe = await list(0, {});
  const facets = indiaFacets(probe.facets ?? []);
  const first = facets ? await list(0, facets) : probe;

  // 2. Remaining pages (Workday only reports the total reliably on the first page)
  const pages = Math.min(Math.ceil((first.total ?? first.jobPostings.length) / PAGE_SIZE), MAX_PAGES);
  const offsets = Array.from({ length: Math.max(pages - 1, 0) }, (_, i) => (i + 1) * PAGE_SIZE);
  const rest = await mapWithLimit(offsets, 4, (o) => list(o, facets ?? {}));
  const postings = [first, ...rest.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))].flatMap((p) => p.jobPostings);

  const jobs = postings.flatMap((p): Job[] => {
    let location = p.locationsText ?? "Unknown";
    if (facets) {
      // Filtered to India already: "2 Locations" hides which, so say so for our India filter
      if (/^\d+ Locations?$/i.test(location)) location = `${location} (India)`;
    } else if (!INDIA.test(location)) {
      return []; // unfiltered fallback: keep India postings only
    }
    return [{
      id: `workday:${slug.toLowerCase()}:${p.externalPath}`,
      source: "workday",
      company: slug,
      title: p.title,
      location,
      isRemote: false,
      url: `${base}/${site}${p.externalPath}`,
      description: "",
      descriptionHtml: "",
      postedAt: parsePostedOn(p.postedOn),
    }];
  });
  if (opts.lite) return jobs;

  // 3. Descriptions only for entry-level developer roles, the ones that get scored
  const wanted = (j: Job) => {
    const c = classify(j.title);
    return c.category === "developer" && c.seniority !== "senior";
  };
  const detailed = await mapWithLimit(jobs, 4, async (j) => {
    if (!wanted(j)) return j;
    const path = j.id.slice(`workday:${slug.toLowerCase()}:`.length);
    const d = DetailSchema.parse(await call(`${api}${path}`)).jobPostingInfo;
    const html = d.jobDescription ?? "";
    return { ...j, isRemote: /remote/i.test(d.remoteType ?? ""), description: htmlToText(html), descriptionHtml: cleanHtml(html) };
  });
  // A failed detail call keeps the job, just without a description
  return detailed.map((r, i) => (r.status === "fulfilled" ? r.value : jobs[i]!));
}
