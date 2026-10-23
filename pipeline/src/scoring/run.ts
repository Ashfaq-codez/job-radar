import { getUnscoredJobs, saveScore, getTopMatches } from "../db/jobs.js";
import { scoreJob, FitSchema } from "./score.js";

const MAX_PER_RUN = 300; // spending cap per run (~$0.03 on nano)
const BATCH_SIZE = 5;   // jobs scored at the same time

export async function scoreNewJobs(): Promise<void> {
  const candidates = (await getUnscoredJobs()).slice(0, MAX_PER_RUN);

  if (candidates.length === 0) {
    console.log("\n🤖 Nothing new to score.");
    return;
  }

  console.log(`\n🤖 Scoring ${candidates.length} jobs with AI...`);
  let totalCost = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (job) => {
        const { fit, cost } = await scoreJob(job);
        await saveScore(job.id, fit.score, JSON.stringify(fit));
        return cost;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        totalCost += r.value;
      } else {
        failed++;
        console.log(`  ⚠️ ${process.env.CI ? shortError(r.reason) : r.reason}`);
      }
    }
  }

  console.log(`🤖 Done. Cost this run: $${totalCost.toFixed(4)}${failed ? `, ${failed} failed` : ""}`);
}

export async function printTopMatches(limit = 10): Promise<void> {
  const rows = await getTopMatches(limit);
  if (rows.length === 0) return;

  console.log(`\n🏆 Top matches:\n`);
  for (const row of rows) {
    const fit = FitSchema.parse(JSON.parse(row.fit_reasons)); // validate what we read back
    console.log(`${row.fit_score} [${fit.verdict}] ${row.company} | ${row.title} | ${row.location}`);
    console.log(`   ✔ ${fit.reasons.join(" · ")}`);
    if (fit.missing.length > 0) console.log(`   ✘ missing: ${fit.missing.join(", ")}`);
    console.log(`   ${row.url}\n`);
  }
}

// In public CI logs, never print a full error: a bad AI reply can echo resume details
function shortError(err: unknown): string {
  if (!(err instanceof Error)) return "scoring failed";
  const status = "status" in err && typeof err.status === "number" ? ` (status ${err.status})` : "";
  return `${err.name}${status}`;
}
