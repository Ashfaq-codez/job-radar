// One-off: fill description_html for jobs saved before we kept formatted descriptions.
// Refetches only boards we already have jobs from; updates nothing else and does no AI scoring.
import { sql } from "../db/client.js";
import { fetchers } from "../sources/index.js";
import { mapWithLimit } from "../lib/pool.js";
import type { Source } from "../types.js";

const missing = (await sql`
  SELECT id, source, company FROM jobs WHERE description_html = ''
`) as { id: string; source: Source; company: string }[];
const wanted = new Set(missing.map((j) => j.id));
const boards = [...new Map(missing.map((j) => [`${j.source}:${j.company}`, j])).values()];
console.log(`Refetching ${boards.length} boards...`);

const results = await mapWithLimit(boards, 10, (b) => fetchers[b.source](b.company));

const updates: { id: string; html: string }[] = [];
for (const [i, r] of results.entries()) {
  if (r.status === "fulfilled") {
    for (const job of r.value) if (wanted.has(job.id) && job.descriptionHtml) updates.push({ id: job.id, html: job.descriptionHtml });
  } else {
    console.log(`❌ ${boards[i]?.source}/${boards[i]?.company}: ${r.reason}`);
  }
}

// Small batches keep each request well under Neon's size limit
let updated = 0;
for (let i = 0; i < updates.length; i += 200) {
  const rows = await sql`
    UPDATE jobs SET description_html = u.html
    FROM jsonb_to_recordset(${JSON.stringify(updates.slice(i, i + 200))}::jsonb) AS u(id text, html text)
    WHERE jobs.id = u.id
    RETURNING jobs.id
  `;
  updated += rows.length;
}
console.log(`✅ Updated ${updated} of ${missing.length} jobs with formatted descriptions`);
