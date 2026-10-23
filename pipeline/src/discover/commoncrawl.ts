import { z } from "zod";
import type { CompanyTarget, Source } from "../types.js";

const USER_AGENT = "job-radar (personal job search project)";
const PAGE_SIZE = 1;            // smaller pages = lighter requests for a busy server
const PAUSE_BETWEEN_PAGES = 1500; // ms, be gentle with a free service

// Where each ATS keeps its boards, and how to pull the slug out of a URL
const PATTERNS: { source: Source; query: string; slug: RegExp }[] = [
  { source: "lever", query: "jobs.lever.co/*", slug: /^https?:\/\/jobs\.lever\.co\/([^/?#]+)/i },
  { source: "ashby", query: "jobs.ashbyhq.com/*", slug: /^https?:\/\/jobs\.ashbyhq\.com\/([^/?#]+)/i },
  { source: "greenhouse", query: "boards.greenhouse.io/*", slug: /^https?:\/\/boards\.greenhouse\.io\/([^/?#]+)/i },
  { source: "greenhouse", query: "job-boards.greenhouse.io/*", slug: /^https?:\/\/job-boards\.greenhouse\.io\/([^/?#]+)/i },
];

// Path segments that look like slugs but aren't companies
const NOT_COMPANIES = new Set(["embed", "api", "v1", "robots.txt", "favicon.ico", "sitemap.xml"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Common Crawl's free server is often busy. Retry with growing waits,
// and say WHY each attempt failed so problems are easy to diagnose.
async function fetchText(url: string, attempts = 5): Promise<string | null> {
  for (let i = 1; i <= attempts; i++) {
    let reason: string;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) return await res.text();
      if (res.status === 404) return null; // "no captures found"
      reason = `HTTP ${res.status}`;
    } catch (err) {
      reason = err instanceof Error ? err.name : String(err); // e.g. TimeoutError
    }
    if (i === attempts) break;
    const wait = 5_000 * 2 ** (i - 1); // 5s, 10s, 20s, 40s
    console.log(`    ${reason}, retrying in ${wait / 1000}s...`);
    await sleep(wait);
  }
  throw new Error(`Common Crawl failed after ${attempts} attempts`);
}

const CrawlListSchema = z.array(z.object({ id: z.string(), "cdx-api": z.string() }));
const PagesSchema = z.object({ pages: z.number() });
const LineSchema = z.object({ url: z.string() });

// The newest N monthly crawls (newest first), so this never needs updating by hand
async function latestCrawls(n: number) {
  const text = await fetchText("https://index.commoncrawl.org/collinfo.json");
  return CrawlListSchema.parse(JSON.parse(text ?? "[]")).slice(0, n);
}

function extractSlugs(body: string, pattern: RegExp, into: string[]) {
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      continue; // a broken line shouldn't stop the rest
    }
    const parsed = LineSchema.safeParse(json);
    if (!parsed.success) continue;
    const raw = pattern.exec(parsed.data.url)?.[1];
    if (!raw) continue;
    try {
      const slug = decodeURIComponent(raw);
      if (!NOT_COMPANIES.has(slug.toLowerCase())) into.push(slug);
    } catch {
      // malformed URL encoding: skip it
    }
  }
}

async function slugsFromCrawl(api: string, query: string, pattern: RegExp): Promise<string[]> {
  const base = `${api}?url=${encodeURIComponent(query)}&output=json&pageSize=${PAGE_SIZE}`;
  const info = await fetchText(`${base}&showNumPages=true`);
  if (!info) return [];
  const { pages } = PagesSchema.parse(JSON.parse(info));

  const slugs: string[] = [];
  let failedPages = 0;

  for (let page = 0; page < pages; page++) {
    try {
      const body = await fetchText(`${base}&fl=url&page=${page}`);
      if (body) extractSlugs(body, pattern, slugs);
      console.log(`  ${query}: page ${page + 1}/${pages}`);
    } catch {
      failedPages++;
      console.log(`  ${query}: page ${page + 1}/${pages} failed, skipping`);
    }
    await sleep(PAUSE_BETWEEN_PAGES);
  }

  if (failedPages > 0) console.log(`  ⚠️ ${failedPages} of ${pages} pages skipped (server busy)`);
  return slugs;
}

export async function discoverBoards(): Promise<CompanyTarget[]> {
  const crawls = await latestCrawls(2);
  const found = new Map<string, CompanyTarget>(); // key: "lever:acme" (lowercase)

  for (const crawl of crawls) {
    for (const p of PATTERNS) {
      console.log(`🔎 ${crawl.id}  ${p.query}`);
      try {
        for (const slug of await slugsFromCrawl(crawl["cdx-api"], p.query, p.slug)) {
          found.set(`${p.source}:${slug.toLowerCase()}`, { source: p.source, slug });
        }
      } catch (err) {
        // One ATS failing shouldn't lose what the others found
        console.log(`  ⚠️ skipped ${p.query}: ${err instanceof Error ? err.message : err}`);
      }
      console.log(`   ${found.size} unique boards so far`);
    }
  }
  return [...found.values()];
}