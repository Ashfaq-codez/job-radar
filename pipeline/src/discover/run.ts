import { discoverBoards } from "./commoncrawl.js";
import { addCandidates, getCompaniesToCheck, saveCheck } from "../db/companies.js";
import { fetchers } from "../sources/index.js";
import { mapWithLimit } from "../lib/pool.js";
import { isIndia } from "../filters.js";

const CHECK_PER_RUN = Number(process.env.CHECK_PER_RUN ?? 3000);
const SKIP_CRAWL = process.argv.includes("--skip-crawl"); // just continue checking

if (!SKIP_CRAWL) {
  console.log("Step 1 of 2: finding job boards in Common Crawl (takes a few minutes)...");
  const boards = await discoverBoards();
  const added = await addCandidates(boards);
  console.log(`✅ Found ${boards.length} boards, ${added} new.\n`);
}

console.log("Step 2 of 2: checking which boards have India jobs...");
const toCheck = await getCompaniesToCheck(CHECK_PER_RUN);
let withIndia = 0;
let done = 0;

await mapWithLimit(toCheck, 10, async (c) => {
  try {
    const jobs = await fetchers[c.source](c.slug, { lite: true });
    const india = jobs.filter(isIndia).length;
    if (india > 0) {
      withIndia++;
      console.log(`  🇮🇳 ${c.source}/${c.slug}: ${india} India jobs`);
    }
    await saveCheck(c.source, c.slug, india, jobs.length, null);
  } catch (err) {
    await saveCheck(c.source, c.slug, 0, 0, String(err).slice(0, 200));
  }
  done++;
  if (done % 200 === 0) console.log(`  ...checked ${done} of ${toCheck.length}`);
});

console.log(`\n✅ Done. ${withIndia} of ${toCheck.length} boards checked have India jobs.`);