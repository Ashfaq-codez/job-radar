import { companies } from "./companies.js";
import { fetchGreenhouseJobs } from "./sources/greenhouse.js";
import { fetchLeverJobs } from "./sources/lever.js";
import { fetchAshbyJobs } from "./sources/ashby.js";
import type { Job, Source } from "./types.js";

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

const INDIA = /\b(bengaluru|bangalore|india)\b/i;
const indiaJobs = allJobs.filter((job) => INDIA.test(job.location));

console.log(`\nTotal: ${allJobs.length} jobs, ${indiaJobs.length} in India\n`);

for (const job of indiaJobs.slice(0, 15)) {
  console.log(`- [${job.source}] ${job.company} | ${job.title} | ${job.location}`);
  console.log(`  ${job.url}`);
}