export async function fetchJson(url: string, label: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

  if (!res.ok) {
    throw new Error(`${label} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}