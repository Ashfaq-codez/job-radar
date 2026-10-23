// Pure helpers for "Add company": find which job board a careers page uses, read JSON-LD job postings,
// and apply robots.txt rules. No network here, so everything is unit-tested in detect-parse.test.ts.

export type BoardSource = "greenhouse" | "lever" | "ashby" | "workday";
export type BoardMatch = { source: BoardSource; slug: string };

// Path segments that look like slugs but aren't companies
const NOT_SLUGS = new Set(["embed", "v0", "v1", "api", "jobs", "job_board", "wday", "static", "assets", "favicon.ico"]);
const SLUG = "([A-Za-z0-9][A-Za-z0-9._-]*)";

// Order matters: specific API/embed forms first, then the hosted board pages
const PATTERNS: { source: BoardSource; re: RegExp }[] = [
  { source: "greenhouse", re: new RegExp(String.raw`greenhouse\.io/embed/job_board(?:/js)?\?(?:[^"'\s<>]*&(?:amp;)?)?for=${SLUG}`, "i") },
  { source: "greenhouse", re: new RegExp(String.raw`boards-api\.greenhouse\.io/v1/boards/${SLUG}`, "i") },
  { source: "greenhouse", re: new RegExp(String.raw`(?:job-)?boards(?:\.eu)?\.greenhouse\.io/${SLUG}`, "i") },
  { source: "lever", re: new RegExp(String.raw`api(?:\.eu)?\.lever\.co/v0/postings/${SLUG}`, "i") },
  { source: "lever", re: new RegExp(String.raw`jobs(?:\.eu)?\.lever\.co/${SLUG}`, "i") },
  { source: "ashby", re: new RegExp(String.raw`api\.ashbyhq\.com/posting-api/job-board/${SLUG}`, "i") },
  { source: "ashby", re: new RegExp(String.raw`jobs\.ashbyhq\.com/${SLUG}`, "i") },
];

// {tenant}.wd{N}.myworkdayjobs.com/[locale/]{site}, or the JSON API path /wday/cxs/{tenant}/{site}
const WORKDAY_PAGE = /([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/;
const WORKDAY_API = /([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/wday\/cxs\/[a-z0-9-]+\/([A-Za-z0-9_-]+)/;

function matchOne(text: string): BoardMatch | null {
  const wd = text.match(WORKDAY_API) ?? text.match(WORKDAY_PAGE);
  if (wd && wd[3] !== "wday") return { source: "workday", slug: `${wd[1]}.${wd[2]}/${wd[3]}` };

  for (const { source, re } of PATTERNS) {
    const m = text.match(re);
    const slug = m?.[1]?.replace(/\.$/, "");
    if (slug && !NOT_SLUGS.has(slug.toLowerCase())) return { source, slug };
  }
  return null;
}

export function detectFromUrl(url: string): BoardMatch | null {
  return matchOne(url);
}

// Scan every URL-ish string in the page: links, iframes, script src, and URLs inside inline JSON
export function detectFromHtml(html: string): BoardMatch | null {
  const text = html.replace(/\\\//g, "/"); // inline JSON escapes slashes: https:\/\/jobs.lever.co
  const urls = text.match(/(?:https?:)?\/\/[^\s"'<>()\\]+/gi) ?? [];
  for (const u of urls) {
    const hit = matchOne(u);
    if (hit) return hit;
  }
  return null;
}

// Applicant tracking systems we recognise but can't fetch yet
const UNSUPPORTED: [string, RegExp][] = [
  ["Keka", /[a-z0-9-]+\.keka\.com/i],
  ["Darwinbox", /darwinbox\.(?:in|com)/i],
  ["Zoho Recruit", /zohorecruit\.(?:com|in|eu)|recruit\.zoho\./i],
  ["Freshteam", /freshteam\.com/i],
  ["SmartRecruiters", /smartrecruiters\.com/i],
  ["Workable", /apply\.workable\.com|workable\.com\/(?:api|j\/)/i],
];

export function detectUnsupported(text: string): string | null {
  for (const [name, re] of UNSUPPORTED) if (re.test(text)) return name;
  return null;
}

// ── JSON-LD ──────────────────────────────────────────────────────────────

function isJobPosting(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const type = (node as Record<string, unknown>)["@type"];
  return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
}

// Walk arrays and @graph containers, collecting every JobPosting object
function collect(node: unknown, out: Record<string, unknown>[]) {
  if (Array.isArray(node)) {
    for (const n of node) collect(n, out);
  } else if (isJobPosting(node)) {
    out.push(node);
  } else if (node && typeof node === "object" && "@graph" in node) {
    collect((node as { "@graph": unknown })["@graph"], out);
  }
}

// Raw JobPosting objects; callers validate the fields they need (with Zod)
export function parseJsonLdJobs(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const blocks = html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of blocks) {
    try {
      collect(JSON.parse(body!.trim()), out);
    } catch {
      // Malformed block: skip it, keep the rest of the page
    }
  }
  return out;
}

// Links on the same site that look like individual job pages
export function jobLinks(html: string, base: string, limit = 30): string[] {
  const origin = new URL(base).origin;
  const found = new Set<string>();
  for (const [, href] of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(href!, base);
      if (u.origin !== origin || u.href === base) continue;
      if (/\/(jobs?|careers|positions|openings)\//i.test(u.pathname)) found.add(u.href);
    } catch {
      // Not a URL
    }
    if (found.size >= limit) break;
  }
  return [...found];
}

export function siteName(html: string): string | null {
  const og = html.match(/<meta\b[^>]*property\s*=\s*["']og:site_name["'][^>]*content\s*=\s*["']([^"']+)["']/i);
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const name = (og?.[1] ?? title?.[1]?.split(/\s[|–—-]\s/)[0])?.trim();
  return name || null;
}

export function isIndia(location: string): boolean {
  return /\b(bengaluru|bangalore|karnataka|india)\b/i.test(location);
}

// ── robots.txt ───────────────────────────────────────────────────────────

// Rules for our user-agent (or "*"). Longest matching rule wins; Allow wins ties. Supports * and $.
export function robotsAllows(robots: string, path: string, agent = "job-radar"): boolean {
  type Group = { agents: string[]; rules: { allow: boolean; pattern: string }[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!lastWasAgent || !current) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }

  const ua = agent.toLowerCase();
  const group =
    groups.find((g) => g.agents.some((a) => a !== "*" && ua.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;

  let best: { allow: boolean; len: number } | null = null;
  for (const r of group.rules) {
    const re = new RegExp("^" + r.pattern.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"));
    if (re.test(path) && (!best || r.pattern.length > best.len || (r.pattern.length === best.len && r.allow))) {
      best = { allow: r.allow, len: r.pattern.length };
    }
  }
  return best?.allow ?? true;
}
