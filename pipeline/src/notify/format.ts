import { z } from "zod";
import type { JobToNotify } from "../db/jobs.js";

// Pure message building, no network or DB, so it's easy to unit-test.

export const MAX_EMBEDS = 10; // Discord's limit per message
const GREEN = 0x22c55e;
const AMBER = 0xf59e0b;

// Only the part of the stored AI result we need
const Reasons = z.object({ reasons: z.array(z.string()) });

export type Embed = {
  title: string;
  url: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline: boolean }[];
};

// Only real Discord webhook URLs, so a saved value can't make the pipeline call anything else
const WEBHOOK = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,30}\/[\w-]{20,200}$/;
export const isDiscordWebhook = (url: string) => WEBHOOK.test(url.trim());

const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

function firstReason(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return Reasons.parse(JSON.parse(raw)).reasons[0] ?? null;
  } catch {
    return null;
  }
}

export function header(jobs: JobToNotify[]): string {
  const fresher = jobs.filter((j) => j.seniority === "fresher").length;
  const interns = jobs.filter((j) => j.employment === "internship").length;
  const parts = [`🎯 ${jobs.length} new match${jobs.length === 1 ? "" : "es"}`];
  if (fresher) parts.push(`${fresher} fresher`);
  if (interns) parts.push(`${interns} internship${interns === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

export function toEmbed(job: JobToNotify): Embed {
  const reason = firstReason(job.fit_reasons);
  const fields = [
    { name: "Score", value: String(job.fit_score), inline: true },
    { name: "Type", value: job.employment === "internship" ? "Internship" : "Full-time", inline: true },
  ];
  if (job.seniority === "fresher") fields.push({ name: "Fresher", value: "✓", inline: true });
  return {
    title: cut(job.title, 256),
    url: job.url,
    description: cut(`**${job.company}** · ${job.location}${reason ? `\n${reason}` : ""}`, 4096),
    color: job.fit_score >= 80 ? GREEN : AMBER,
    fields,
  };
}

export function chunk<T>(items: T[], size = MAX_EMBEDS): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
