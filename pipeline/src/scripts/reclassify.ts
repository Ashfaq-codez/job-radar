import { sql } from "../db/client.js";
import { classify } from "../classify.js";

const rows = (await sql`SELECT id, title FROM jobs`) as { id: string; title: string }[];
const updates = rows.map((r) => ({ id: r.id, ...classify(r.title) }));

await sql`
  UPDATE jobs AS j
  SET category = u.category, employment = u.employment, seniority = u.seniority
  FROM jsonb_to_recordset(${JSON.stringify(updates)}::jsonb)
       AS u(id text, category text, employment text, seniority text)
  WHERE j.id = u.id
`;

console.log(`Reclassified ${updates.length} jobs:\n`);
console.table(
  await sql`
    SELECT category, employment, seniority, count(*)::int AS jobs
    FROM jobs GROUP BY 1, 2, 3 ORDER BY jobs DESC
  `
);