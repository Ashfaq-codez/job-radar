const TIMEOUT_MS = 45_000; // big boards (thousands of jobs) need time to download

export async function fetchJson(url: string, label: string): Promise<unknown> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) {
        throw new Error(`${label} failed: ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      // Only timeouts get a second try. A 404 won't fix itself by retrying.
      if (!timedOut || attempt === 2) {
        throw timedOut ? new Error(`${label} timed out after ${TIMEOUT_MS / 1000}s`) : err;
      }
      console.log(`  ⏳ ${label} timed out, retrying once...`);
    }
  }
  throw new Error(`${label}: unreachable`);
}