import { z } from "zod";
import { getJobsToNotify, markNotified } from "../db/jobs.js";
import { chunk, header, toEmbed } from "./format.js";

// Sends new strong matches to a Discord channel via a webhook (free).
// The webhook URL is a secret: it's never logged, errors only show the status.

const MAX_PER_RUN = 20;
const MinScore = z.coerce.number().int().min(0).max(100);
const RateLimit = z.object({ retry_after: z.number().nonnegative() });

function webhookUrl(): string | null {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.log("Discord skipped (DISCORD_WEBHOOK_URL not set)");
    return null;
  }
  return url;
}

function minScore(): number {
  const raw = process.env.MIN_NOTIFY_SCORE;
  if (!raw) return 70;
  const parsed = MinScore.safeParse(raw);
  if (parsed.success) return parsed.data;
  console.log("MIN_NOTIFY_SCORE isn't a number from 0 to 100, using 70");
  return 70;
}

// POST one message. Returns true on success. On 429 waits retry_after and retries once.
async function post(url: string, body: unknown, retried = false): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const slow = err instanceof Error && err.name === "TimeoutError";
    console.log(`Discord send failed (${slow ? "timed out" : "network error"})`);
    return false;
  }
  if (res.ok) return true;

  if (res.status === 429 && !retried) {
    const limit = RateLimit.safeParse(await res.json().catch(() => null));
    const seconds = Math.min(limit.success ? limit.data.retry_after : 1, 60);
    console.log(`Discord rate limit, retrying in ${seconds}s`);
    await new Promise((r) => setTimeout(r, seconds * 1000));
    return post(url, body, true);
  }

  const detail = (await res.text().catch(() => "")).slice(0, 200);
  console.log(`Discord send failed (status ${res.status})${detail ? `: ${detail}` : ""}`);
  return false;
}

export async function notifyDiscord(): Promise<void> {
  try {
    const url = webhookUrl();
    if (!url) return;

    const jobs = await getJobsToNotify(minScore(), MAX_PER_RUN);
    if (jobs.length === 0) return; // nothing new, send nothing

    let sent = 0;
    for (const [i, group] of chunk(jobs).entries()) {
      const ok = await post(url, {
        ...(i === 0 ? { content: header(jobs) } : {}),
        embeds: group.map(toEmbed),
      });
      if (!ok) continue; // left unmarked, so the next run retries it
      await markNotified(group.map((j) => j.id));
      sent += group.length;
    }
    console.log(`\n📣 Discord: sent ${sent} of ${jobs.length} new matches`);
  } catch (err) {
    console.log(`Discord notify failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function sendTestMessage(): Promise<boolean> {
  const url = webhookUrl();
  if (!url) return false;
  return post(url, { content: "✅ job-radar is connected" });
}
