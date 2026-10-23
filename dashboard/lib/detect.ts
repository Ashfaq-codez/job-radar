import "server-only";
import { z } from "zod";
import {
  detectFromHtml,
  detectFromUrl,
  detectUnsupported,
  isIndia,
  jobLinks,
  parseJsonLdJobs,
  siteName,
  type BoardMatch,
  type BoardSource,
} from "./detect-parse";
import { FetchProblem, parsePublicUrl, robotsAllowed, safeFetch, USER_AGENT } from "./safe-fetch";

export type Detection =
  | { kind: "board"; source: BoardSource; slug: string; name: string; totalJobs: number; indiaJobs: number }
  | { kind: "careers"; url: string; name: string; jobsFound: number }
  | { kind: "unsupported"; ats: string }
  | { kind: "none" }
  | { kind: "error"; message: string };

// ── Board APIs: the same public endpoints the pipeline uses, validated with Zod ──

const Greenhouse = z.object({ jobs: z.array(z.object({ location: z.object({ name: z.string() }).nullish() })) });
const Lever = z.array(z.object({ categories: z.object({ location: z.string().nullish() }).nullish() }));
const Ashby = z.object({ jobs: z.array(z.object({ location: z.string().nullish() })) });

// Workday nests location facets (country → city) with a count on each value
type Facet = { descriptor?: string; count?: number; values?: Facet[] };
const WorkdayFacet: z.ZodType<Facet> = z.lazy(() =>
  z.object({ descriptor: z.string().optional(), count: z.number().optional(), values: z.array(WorkdayFacet).optional() })
);
const Workday = z.object({
  total: z.number(),
  jobPostings: z.array(z.object({ locationsText: z.string().nullish() })),
  facets: z.array(WorkdayFacet).optional(),
});

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init.headers },
  }).catch((err: unknown) => {
    const slow = err instanceof Error && err.name === "TimeoutError";
    throw new FetchProblem(slow ? "The job board took longer than 15 seconds to answer. Try again later." : "Couldn't reach the job board's API.");
  });
  if (res.status === 404) throw new FetchProblem("Found the job board, but its API says it doesn't exist (the company may have moved to another one).");
  if (!res.ok) throw new FetchProblem(`The job board API answered ${res.status}.`);
  return res.json();
}

// India jobs from Workday's location facets: an exact "India" value if there is one, else matching cities
function workdayIndia(facets: Facet[]): number | null {
  const all: Facet[] = [];
  const walk = (fs: Facet[]) => fs.forEach((f) => (all.push(f), f.values && walk(f.values)));
  walk(facets);
  const counted = all.filter((f) => f.descriptor && typeof f.count === "number");
  const country = counted.find((f) => /^india$/i.test(f.descriptor!.trim()));
  if (country) return country.count!;
  const cities = counted.filter((f) => isIndia(f.descriptor!));
  return cities.length ? cities.reduce((s, f) => s + f.count!, 0) : null;
}

async function countBoard({ source, slug }: BoardMatch): Promise<{ totalJobs: number; indiaJobs: number }> {
  const slugPart = encodeURIComponent(slug);
  const tally = (locations: (string | null | undefined)[]) => ({
    totalJobs: locations.length,
    indiaJobs: locations.filter((l) => l && isIndia(l)).length,
  });

  if (source === "greenhouse") {
    const d = Greenhouse.parse(await getJson(`https://boards-api.greenhouse.io/v1/boards/${slugPart}/jobs`));
    return tally(d.jobs.map((j) => j.location?.name));
  }
  if (source === "lever") {
    const d = Lever.parse(await getJson(`https://api.lever.co/v0/postings/${slugPart}?mode=json`));
    return tally(d.map((p) => p.categories?.location));
  }
  if (source === "ashby") {
    const d = Ashby.parse(await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slugPart}`));
    return tally(d.jobs.map((j) => j.location));
  }

  // Workday: slug is "{tenant}.wd{N}/{site}"
  const [host, site] = slug.split("/") as [string, string];
  const tenant = host.split(".")[0]!;
  const d = Workday.parse(
    await getJson(`https://${host}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }),
    })
  );
  const india = workdayIndia(d.facets ?? []) ?? d.jobPostings.filter((j) => j.locationsText && isIndia(j.locationsText)).length;
  return { totalJobs: d.total, indiaJobs: india };
}

const JobPostingName = z.object({ hiringOrganization: z.object({ name: z.string().min(1) }).optional() });

function prettySlug(slug: string): string {
  const base = slug.includes("/") ? slug.split(".")[0]! : slug;
  return base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Main entry ──

export async function detectBoard(input: string): Promise<Detection> {
  try {
    const start = parsePublicUrl(input);

    // 1. The link itself may already be a board
    const direct = detectFromUrl(start.href);
    if (direct) return { kind: "board", ...direct, name: prettySlug(direct.slug), ...(await countBoard(direct)) };

    // 2. Otherwise read the page and look for a board in its links, iframes and scripts
    const page = await safeFetch(start.href);
    if (page.status >= 400) return { kind: "error", message: `The page answered ${page.status}. Check the link.` };
    const board = detectFromUrl(page.url) ?? detectFromHtml(page.text);
    if (board) {
      return { kind: "board", ...board, name: siteName(page.text) ?? prettySlug(board.slug), ...(await countBoard(board)) };
    }

    // 3. No supported board: read schema.org JobPosting data, if robots.txt lets us
    if (!(await robotsAllowed(page.url))) {
      return { kind: "error", message: "This site's robots.txt asks bots not to read that page, so job-radar won't track it." };
    }
    const postings = parseJsonLdJobs(page.text);
    if (postings.length === 0) {
      // Listing pages often only link to jobs; peek at a few job pages, 3 at a time
      const links = jobLinks(page.text, page.url, 6);
      for (let i = 0; i < links.length && postings.length === 0; i += 3) {
        const pages = await Promise.allSettled(links.slice(i, i + 3).map((l) => safeFetch(l)));
        for (const p of pages) if (p.status === "fulfilled") postings.push(...parseJsonLdJobs(p.value.text));
      }
    }
    if (postings.length > 0) {
      const org = postings.map((p) => JobPostingName.safeParse(p)).find((r) => r.success && r.data.hiringOrganization);
      const name = (org?.success && org.data.hiringOrganization?.name) || siteName(page.text) || new URL(page.url).hostname;
      return { kind: "careers", url: page.url, name, jobsFound: postings.length };
    }

    // 4. A tracker we know about but can't fetch yet?
    const ats = detectUnsupported(page.url + "\n" + page.text);
    return ats ? { kind: "unsupported", ats } : { kind: "none" };
  } catch (err) {
    if (err instanceof FetchProblem) return { kind: "error", message: err.message };
    if (err instanceof Error && err.name === "TimeoutError") return { kind: "error", message: "That took longer than 15 seconds. Try again later." };
    if (err instanceof z.ZodError) return { kind: "error", message: "The job board answered in a format job-radar doesn't understand." };
    console.error("detectBoard failed", err);
    return { kind: "error", message: "Something went wrong while checking that page. Try again." };
  }
}
