// Runs fn on every item, with at most `limit` running at the same time.
// Returns results in the same shape (and order) as Promise.allSettled.
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++; // safe: JavaScript runs one line at a time
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i] as T) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  // Start `limit` workers; each keeps grabbing the next item until none are left
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}