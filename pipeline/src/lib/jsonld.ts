// schema.org JobPosting JSON-LD helpers, same as dashboard/lib/detect-parse.ts.

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
