import { getActiveProfiles, getOpenJobs, getUnscoredForUser, saveUserScore, syncMatches, type ActiveProfile } from "../db/users.js";
import { matchesProfile } from "../match.js";
import { describePreferences, scoreJob } from "./score.js";

const MAX_PER_USER = 150; // per person per run
const BATCH_SIZE = 5;     // jobs scored at the same time

// Overall spending cap per run (~$0.04 at 400 on nano). Set MAX_SCORES_PER_RUN to change it.
function overallCap(): number {
  const raw = process.env.MAX_SCORES_PER_RUN?.trim(); // empty when the GitHub variable isn't set
  const n = raw ? Number(raw) : 400;
  return Number.isInteger(n) && n >= 0 ? n : 400;
}

// Logs say "user 2 of 3", never names, emails or resume text (CI logs are public)
const who = (i: number, total: number) => `user ${i + 1} of ${total}`;

// For each onboarded person: refresh which open jobs fit their profile, then score new ones
export async function matchAndScore(): Promise<ActiveProfile[]> {
  const profiles = await getActiveProfiles();
  if (profiles.length === 0) {
    console.log("\n👤 No onboarded users yet, nothing to match or score.");
    return profiles;
  }

  const jobs = await getOpenJobs();
  console.log(`\n👤 Matching ${jobs.length} open jobs for ${profiles.length} users...`);
  for (const [i, p] of profiles.entries()) {
    const ids = jobs.filter((j) => matchesProfile(j, p)).map((j) => j.id);
    const { added } = await syncMatches(p.user_id, ids);
    console.log(`  ${who(i, profiles.length)}: ${ids.length} matching, ${added} new`);
  }

  let budget = overallCap();
  let totalCost = 0;
  let scored = 0;
  let failed = 0;

  for (const [i, p] of profiles.entries()) {
    // Share what's left fairly between the people still to go
    const allowance = Math.min(MAX_PER_USER, Math.ceil(budget / (profiles.length - i)));
    const candidates = await getUnscoredForUser(p.user_id, allowance);
    if (candidates.length === 0) continue;
    budget -= candidates.length;

    console.log(`\n🤖 Scoring ${candidates.length} jobs for ${who(i, profiles.length)}...`);
    const candidate = { resume: p.resume_text, preferences: describePreferences(p) };

    for (let b = 0; b < candidates.length; b += BATCH_SIZE) {
      const results = await Promise.allSettled(
        candidates.slice(b, b + BATCH_SIZE).map(async (job) => {
          const { fit, cost } = await scoreJob(job, candidate);
          await saveUserScore(p.user_id, job.id, fit.score, JSON.stringify(fit));
          return cost;
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          totalCost += r.value;
          scored++;
        } else {
          failed++;
          console.log(`  ⚠️ ${shortError(r.reason)}`);
        }
      }
    }
  }

  console.log(
    scored + failed === 0
      ? "\n🤖 Nothing new to score."
      : `🤖 Done. Scored ${scored}. Cost this run: $${totalCost.toFixed(4)}${failed ? `, ${failed} failed` : ""}`
  );
  return profiles;
}

// Never print a full error: a bad AI reply can echo resume details, and logs may be public
function shortError(err: unknown): string {
  if (!(err instanceof Error)) return "scoring failed";
  const status = "status" in err && typeof err.status === "number" ? ` (status ${err.status})` : "";
  return `${err.name}${status}`;
}
