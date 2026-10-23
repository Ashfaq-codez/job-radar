"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { z } from "zod";
import { detectBoard } from "@/lib/detect";
import { STATUSES, type Status } from "@/lib/jobs";

function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

// Server actions are public endpoints: never trust what the client sends
export async function updateStatus(id: unknown, status: unknown): Promise<void> {
  if (typeof id !== "string" || !isStatus(status)) {
    throw new Error("Invalid status update");
  }

  await sql`
    UPDATE jobs SET status = ${status}, status_changed_at = now()
    WHERE id = ${id}
  `;
  revalidatePath("/", "layout"); // refresh Overview, Jobs and Applied
}

// ── Apply → "Did you apply?" ─────────────────────────────────────────────
// Clicking "Apply on company site" only records that the posting was opened.
// The job moves to Applied when you confirm it.

const JobId = z.string().min(1).max(1000);

function jobId(id: unknown): string {
  const parsed = JobId.safeParse(id);
  if (!parsed.success) throw new Error("Invalid job id");
  return parsed.data;
}

export async function markOpened(id: unknown): Promise<void> {
  await sql`UPDATE jobs SET opened_at = now() WHERE id = ${jobId(id)}`;
  revalidatePath("/", "layout");
}

export async function confirmApplied(id: unknown): Promise<void> {
  await sql`
    UPDATE jobs SET status = 'applied', status_changed_at = now()
    WHERE id = ${jobId(id)} AND status IN ('new', 'saved')`;
  revalidatePath("/", "layout");
}

export async function clearOpened(id: unknown): Promise<void> {
  await sql`UPDATE jobs SET opened_at = NULL WHERE id = ${jobId(id)}`;
  revalidatePath("/", "layout");
}

export async function saveNotes(id: unknown, notes: unknown): Promise<void> {
  if (typeof id !== "string" || typeof notes !== "string") {
    throw new Error("Invalid notes update");
  }

  await sql`UPDATE jobs SET notes = ${notes.slice(0, 5000)} WHERE id = ${id}`;
  revalidatePath("/applied");
}

// ── Add company ──────────────────────────────────────────────────────────

export type AddCompanyState = { tone: "success" | "info" | "error"; message: string } | null;

const SOURCE_LABEL = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", workday: "Workday" } as const;
const AddCompanyInput = z.object({ url: z.string().trim().min(1, "Paste a careers page link first.").max(500, "That URL is too long (max 500 characters).") });

export async function addCompany(_prev: AddCompanyState, formData: FormData): Promise<AddCompanyState> {
  const input = AddCompanyInput.safeParse({ url: formData.get("url") });
  if (!input.success) return { tone: "error", message: input.error.issues[0]?.message ?? "Invalid URL." };

  const found = await detectBoard(input.data.url);
  switch (found.kind) {
    case "error":
      return { tone: "error", message: found.message };
    case "none":
      return { tone: "info", message: "Couldn't find any job listings on this page. Try the page that lists the open roles." };
    case "unsupported":
      return { tone: "info", message: `This site uses ${found.ats}, which isn't supported yet.` };
  }

  // Board slugs are case-insensitive except Workday's site name; careers pages are keyed by their URL
  const row =
    found.kind === "board"
      ? { source: found.source, slug: found.source === "workday" ? found.slug : found.slug.toLowerCase(), name: found.name, total: found.totalJobs, india: found.indiaJobs }
      : { source: "careers", slug: found.url, name: found.name, total: found.jobsFound, india: 0 };

  const existing = await sql`SELECT added_by FROM companies WHERE source = ${row.source} AND lower(slug) = lower(${row.slug})`;
  if (existing.length > 0) {
    const who = existing[0]!.added_by === "dashboard" ? "You already added" : "job-radar already tracks";
    return { tone: "info", message: `${who} ${row.name}.` };
  }

  const inserted = await sql`
    INSERT INTO companies (source, slug, name, careers_url, added_by, added_at, india_jobs, total_jobs, last_checked_at)
    VALUES (${row.source}, ${row.slug}, ${row.name}, ${input.data.url}, 'dashboard', now(), ${row.india}, ${row.total}, now())
    ON CONFLICT (source, slug) DO NOTHING
    RETURNING slug`;
  if (inserted.length === 0) return { tone: "info", message: `job-radar already tracks ${row.name}.` };

  revalidatePath("/companies");
  const later = "They'll show up after the next pipeline run.";
  return found.kind === "board"
    ? { tone: "success", message: `Added ${row.name} (${SOURCE_LABEL[found.source]}): ${found.totalJobs} open jobs, ${found.indiaJobs} in India. ${later}` }
    : { tone: "success", message: `Added ${row.name} (careers page): found ${found.jobsFound} job posting${found.jobsFound === 1 ? "" : "s"}. ${later}` };
}

const RemoveCompanyInput = z.object({
  source: z.enum(["greenhouse", "lever", "ashby", "workday", "careers"]),
  slug: z.string().min(1).max(500),
});

// Only companies you added can be removed; discovered ones would just be found again
export async function removeCompany(source: unknown, slug: unknown): Promise<void> {
  const input = RemoveCompanyInput.safeParse({ source, slug });
  if (!input.success) throw new Error("Invalid company");
  await sql`DELETE FROM companies WHERE source = ${input.data.source} AND slug = ${input.data.slug} AND added_by = 'dashboard'`;
  revalidatePath("/companies");
}
