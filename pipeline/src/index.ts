import { companies as manualCompanies } from "./companies.js";
import { getActiveCompanies } from "./db/companies.js";
import { upsertJobs } from "./db/jobs.js";
import { fetchers } from "./sources/index.js";
import { mapWithLimit } from "./lib/pool.js";
import { isIndia, passesRules } from "./filters.js";
import { scoreNewJobs, printTopMatches } from "./scoring/run.js";
import { notifyDiscord } from "./notify/discord.js";
import type { CompanyTarget, Job } from "./types.js";

// ── 1. Which boards to fetch: your manual list + everything discovery found ──
const allTargets: CompanyTarget[] = [...manualCompanies, ...(await getActiveCompanies())];
const companies = [
  ...new Map(allTargets.map((c) => [`${c.source}:${c.slug.toLowerCase()}`, c])).values(),
];
console.log(`Fetching ${companies.length} job boards...`);

// ── 2. Fetch them, at most 10 at a time ──
const results = await mapWithLimit(companies, 10, (c) => fetchers[c.source](c.slug));

const allJobs: Job[] = [];
let failed = 0;

for (const [i, result] of results.entries()) {
  const c = companies[i];
  if (!c) continue; // TS can't prove companies[i] exists, so we check

  if (result.status === "fulfilled") {
    allJobs.push(...result.value);
  } else {
    failed++;
    console.log(`❌ ${c.source}/${c.slug}: ${result.reason}`);
  }
}

console.log(
  `✅ ${companies.length - failed} boards fetched, ${failed} failed, ${allJobs.length} jobs total`
);

// ── 3. Dedupe level 1 (same job twice in this run), then keep only India jobs ──
const uniqueJobs = [...new Map(allJobs.map((job) => [job.id, job])).values()];
const indiaJobs = uniqueJobs.filter(isIndia);

// ── 4. Save. Dedupe level 2: the database handles jobs seen in earlier runs ──
const { newIds, seenCount } = await upsertJobs(indiaJobs);
console.log(`\n💾 Saved ${indiaJobs.length} India jobs: ${newIds.length} new, ${seenCount} already seen`);

// ── 5. Show new jobs that pass the rules (India + entry level) ──
const newSet = new Set(newIds);
const newMatches = indiaJobs.filter((job) => newSet.has(job.id) && passesRules(job));

if (newMatches.length === 0) {
  console.log("No new entry-level India jobs since last run.");
} else {
  console.log(`\n🆕 ${newMatches.length} new entry-level India jobs:\n`);
  for (const job of newMatches.slice(0, 15)) {
    console.log(`- [${job.source}] ${job.company} | ${job.title} | ${job.location}`);
    console.log(`  ${job.url}`);
  }
}

// ── 6. AI scoring + best matches ──
await scoreNewJobs();
await printTopMatches();

// ── 7. Send new strong matches to Discord ──
await notifyDiscord();