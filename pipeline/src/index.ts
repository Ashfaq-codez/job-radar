import { companies } from "./companies.js";
import { fetchGreenhouseJobs } from "./sources/greenhouse.js";
import { fetchLeverJobs } from "./sources/lever.js";
import { fetchAshbyJobs } from "./sources/ashby.js";
import type { Job, Source } from "./types.js";
import { upsertJobs } from "./db/jobs.js";

// Look up the right fetcher for each source
const fetchers: Record<Source, (company: string) => Promise<Job[]>> = {
  greenhouse: fetchGreenhouseJobs,
  lever: fetchLeverJobs,
  ashby: fetchAshbyJobs,
};

// Start ALL fetches at once; allSettled waits for every one, even failures
const results = await Promise.allSettled(
  companies.map((c) => fetchers[c.source](c.slug))
);

const allJobs: Job[] = [];

for (const [i, result] of results.entries()) {
  const c = companies[i];
  if (!c) continue; // TS can't prove companies[i] exists, so we check

  const label = `${c.source}/${c.slug}`;
  if (result.status === "fulfilled") {
    console.log(`✅ ${label}: ${result.value.length} jobs`);
    allJobs.push(...result.value);
  } else {
    console.log(`❌ ${label}: ${result.reason}`);
  }
}

// Dedupe level 1: same id twice in THIS run → keep one
const uniqueJobs = [...new Map(allJobs.map((job) => [job.id, job])).values()];

// Dedupe level 2: the database handles jobs seen in earlier runs
const { newIds, seenCount } = await upsertJobs(uniqueJobs);
console.log(`\n💾 Saved: ${newIds.length} new, ${seenCount} already seen`);

const INDIA = /\b(bengaluru|bangalore|india)\b/i;
const newSet = new Set(newIds);
const newIndiaJobs = uniqueJobs.filter(
  (job) => newSet.has(job.id) && INDIA.test(job.location)
);

if (newIndiaJobs.length === 0) {
  console.log("No new India jobs since last run.");
} else {
  console.log(`\n🆕 ${newIndiaJobs.length} new India jobs:\n`);
  for (const job of newIndiaJobs.slice(0, 15)) {
    console.log(`- [${job.source}] ${job.company} | ${job.title} | ${job.location}`);
    console.log(`  ${job.url}`);
  }
}