export type SP = Record<string, string | string[] | undefined>;

export function first(sp: SP, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

// Build a link from the current params plus changes. null removes a param.
export function hrefWith(path: string, sp: SP, changes: Record<string, string | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v) params.set(key, v);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}