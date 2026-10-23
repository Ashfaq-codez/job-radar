// robots.txt rules, same as dashboard/lib/detect-parse.ts.
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
