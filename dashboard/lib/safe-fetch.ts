import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { robotsAllows } from "./detect-parse";

// Fetching a URL someone typed in is risky: it could point at this machine or the local network (SSRF).
// Every request here checks the host's real IP addresses first, again after each redirect.

export const USER_AGENT = "job-radar (personal job search project)";
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 2 * 1024 * 1024;

// Errors whose message is safe and useful to show the user
export class FetchProblem extends Error {}

const blocked = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) {
  blocked.addSubnet(net, bits, "ipv6");
}

function isPrivate(ip: string): boolean {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i); // IPv4 written as IPv6
  if (mapped) return blocked.check(mapped[1]!, "ipv4");
  return blocked.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
}

export function parsePublicUrl(input: string): URL {
  if (input.length > 500) throw new FetchProblem("That URL is too long (max 500 characters).");
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new FetchProblem("That doesn't look like a URL. Paste the full link, starting with https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchProblem("Only http(s) links are allowed.");
  if (url.username || url.password) throw new FetchProblem("Links with a username or password aren't allowed.");
  return url;
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new FetchProblem("Local addresses aren't allowed.");
  }
  let addresses: { address: string }[];
  try {
    addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  } catch {
    throw new FetchProblem(`Couldn't find the site ${host}. Check the link.`);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivate(a.address))) {
    throw new FetchProblem("That address points to a private network, so it isn't allowed.");
  }
}

// Read the body as a stream so a huge page can't fill memory
async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new FetchProblem("That page is larger than 2 MB, so it wasn't read.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function safeFetch(input: string): Promise<{ url: string; status: number; text: string }> {
  let url = parsePublicUrl(input);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    for (let hop = 0; ; hop++) {
      await assertPublicHost(url);
      const res = await fetch(url, { redirect: "manual", signal, headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" } });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        if (hop >= MAX_REDIRECTS) throw new FetchProblem("That link redirects too many times.");
        url = parsePublicUrl(new URL(location, url).href);
        continue;
      }
      return { url: url.href, status: res.status, text: await readCapped(res) };
    }
  } catch (err) {
    if (err instanceof FetchProblem) throw err;
    if (err instanceof Error && err.name === "TimeoutError") throw new FetchProblem("The site took longer than 15 seconds to respond.");
    throw new FetchProblem(`Couldn't load ${url.hostname}.`);
  }
}

// Missing or unreadable robots.txt means no rules, so the page is allowed
export async function robotsAllowed(pageUrl: string): Promise<boolean> {
  const u = new URL(pageUrl);
  try {
    const res = await safeFetch(`${u.origin}/robots.txt`);
    if (res.status !== 200) return true;
    return robotsAllows(res.text, u.pathname + u.search);
  } catch {
    return true;
  }
}
