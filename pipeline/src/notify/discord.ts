import { z } from "zod";
import { getUserJobsToNotify, markUserNotified, type ActiveProfile } from "../db/users.js";
import { chunk, header, isDiscordWebhook, toEmbed } from "./format.js";

// Sends each person's new strong matches to their Discord channel via a webhook (free).
// Webhook URLs are secrets: they're never logged, errors only show the status.

const MAX_PER_RUN = 20; // per person
const RateLimit = z.object({ retry_after: z.number().nonnegative() });

// A person's own webhook; the owner falls back to DISCORD_WEBHOOK_URL from the environment
function webhookFor(p: ActiveProfile): string | null {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const url = p.discord_webhook_url || (owner && p.email.toLowerCase() === owner ? process.env.DISCORD_WEBHOOK_URL : null);
  return url && isDiscordWebhook(url) ? url : null;
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

export async function notifyDiscord(profiles: ActiveProfile[]): Promise<void> {
  for (const [i, p] of profiles.entries()) {
    const label = `user ${i + 1} of ${profiles.length}`;
    try {
      const url = webhookFor(p);
      if (!url) continue; // no alerts set up

      const jobs = await getUserJobsToNotify(p.user_id, p.min_notify_score, MAX_PER_RUN);
      if (jobs.length === 0) continue; // nothing new, send nothing

      let sent = 0;
      for (const [c, group] of chunk(jobs).entries()) {
        const ok = await post(url, {
          ...(c === 0 ? { content: header(jobs) } : {}),
          embeds: group.map(toEmbed),
        });
        if (!ok) continue; // left unmarked, so the next run retries it
        await markUserNotified(p.user_id, group.map((j) => j.id));
        sent += group.length;
      }
      console.log(`📣 Discord (${label}): sent ${sent} of ${jobs.length} new matches`);
    } catch (err) {
      console.log(`Discord notify failed (${label}): ${err instanceof Error ? err.name : "error"}`);
    }
  }
}

// npm run notify:test → checks the owner's DISCORD_WEBHOOK_URL
export async function sendTestMessage(): Promise<boolean> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.log("Discord skipped (DISCORD_WEBHOOK_URL not set)");
    return false;
  }
  if (!isDiscordWebhook(url)) {
    console.log("DISCORD_WEBHOOK_URL doesn't look like a Discord webhook (https://discord.com/api/webhooks/...)");
    return false;
  }
  return post(url, { content: "✅ job-radar is connected" });
}
