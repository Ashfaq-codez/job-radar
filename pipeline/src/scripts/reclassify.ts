import { sql } from "../db/client.js";
import { classify } from "../classify.js";

const rows = (await sql`SELECT id, title, description, seniority FROM jobs`) as {
  id: string;
  title: string;
  description: string | null;
  seniority: string | null;
}[];
const updates = rows.map((r) => ({ id: r.id, ...classify(r.title, r.description ?? "") }));

await sql`
  UPDATE jobs AS j
  SET category = u.category, employment = u.employment, seniority = u.seniority,
      min_years = u."minYears", experience_text = u."experienceText"
  FROM jsonb_to_recordset(${JSON.stringify(updates)}::jsonb)
       AS u(id text, category text, employment text, seniority text, "minYears" integer, "experienceText" text)
  WHERE j.id = u.id
`;

// What the description changed: compare with the label the title alone would give
const changes = new Map<string, number>();
for (const [i, r] of rows.entries()) {
  const fromTitle = classify(r.title).seniority;
  const now = updates[i]!.seniority;
  if (fromTitle === now) continue;
  const key = `${fromTitle} → ${now}`;
  changes.set(key, (changes.get(key) ?? 0) + 1);
}
const take = (key: string) => {
  const n = changes.get(key) ?? 0;
  changes.delete(key);
  return n;
};

console.log(`Reclassified ${updates.length} jobs (${updates.filter((u) => u.minYears !== null).length} state years of experience).\n`);
console.log("Seniority changed by the description:");
console.log(`  entry → senior:  ${take("entry → senior")}`);
console.log(`  entry → fresher: ${take("entry → fresher")}`);
const other = [...changes].map(([k, n]) => `${k}: ${n}`);
console.log(`  other changes:   ${other.length ? other.join(", ") : 0}\n`);

console.table(
  await sql`
    SELECT category, employment, seniority, count(*)::int AS jobs
    FROM jobs GROUP BY 1, 2, 3 ORDER BY jobs DESC
  `
);
