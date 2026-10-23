"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { suggestFromResume } from "@/lib/ai";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getWebhook, hasConsented, isDiscordWebhook, parseProfileForm, saveProfile, saveResume } from "@/lib/profile";
import { ResumeProblem, resumeText } from "@/lib/resume";
import { actionUser } from "@/lib/session";

// Profile, resume, alerts and account deletion. Every action works only on the caller's own rows.

export type FormState = { tone: "success" | "error"; message: string; field?: string } | null;

export async function uploadResume(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser();
  const already = await hasConsented(user.id);
  const consent = formData.get("consent") === "on";
  if (!already && !consent) return { tone: "error", message: "Please tick the box to agree before uploading.", field: "consent" };

  let text: string;
  try {
    text = await resumeText(formData.get("resume"));
  } catch (err) {
    if (err instanceof ResumeProblem) return { tone: "error", message: err.message, field: "resume" };
    console.error("Resume upload failed:", err instanceof Error ? err.name : "unknown error");
    return { tone: "error", message: "Something went wrong reading that file. Try again." };
  }

  const suggestions = await suggestFromResume(text);
  await saveResume(user.id, text, suggestions, consent || already);
  revalidatePath("/", "layout");
  return {
    tone: "success",
    message: suggestions
      ? "Resume read. We pre-filled your skills and roles; check them below."
      : "Resume saved. Fill in your preferences below (AI suggestions weren't available this time).",
  };
}

export async function saveProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser();
  const parsed = parseProfileForm(formData);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { tone: "error", message: issue?.message ?? "Check the form and try again.", field: String(issue?.path[0] ?? "") };
  }
  if (!(await hasConsented(user.id))) return { tone: "error", message: "Upload your resume first." };

  await saveProfile(user.id, parsed.data);
  revalidatePath("/", "layout");
  if (formData.get("mode") === "onboarding") redirect("/?welcome=1");
  return { tone: "success", message: "Saved. Your matches update on the next pipeline run." };
}

// Posts one message to the saved webhook. The URL is never sent back or logged.
export async function sendTestAlert(): Promise<FormState> {
  const user = await actionUser();
  const fallback = user.isOwner ? process.env.DISCORD_WEBHOOK_URL ?? null : null;
  const url = (await getWebhook(user.id)) ?? fallback;
  if (!url || !isDiscordWebhook(url)) return { tone: "error", message: "Save a Discord webhook URL first." };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "✅ job-radar is connected. Strong matches will arrive here." }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { tone: "success", message: "Sent! Check your Discord channel." };
    if (res.status === 404 || res.status === 401) return { tone: "error", message: "Discord says that webhook doesn't exist any more. Create a new one and save it." };
    if (res.status === 429) return { tone: "error", message: "Discord is rate-limiting this webhook. Try again in a minute." };
    return { tone: "error", message: `Discord answered ${res.status}. Try again later.` };
  } catch {
    return { tone: "error", message: "Couldn't reach Discord. Try again later." };
  }
}

const Confirm = z.literal("DELETE");

// Removes the person's profile, resume text, tracker and sign-in. Shared jobs and companies stay.
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser();
  if (!Confirm.safeParse(formData.get("confirm")).success) {
    return { tone: "error", message: "Type DELETE (in capitals) to confirm.", field: "confirm" };
  }
  if (user.isOwner) {
    return { tone: "error", message: "The owner account can't be deleted from here (it runs the admin pages). See docs/MULTI_USER.md." };
  }

  await auth.api.signOut({ headers: await headers() }); // clears the session cookie
  // profiles, user_jobs, sessions and accounts all cascade from "user"; companies keep a NULL added_by_user
  await sql`DELETE FROM user_jobs WHERE user_id = ${user.id}`;
  await sql`DELETE FROM profiles WHERE user_id = ${user.id}`;
  await sql`DELETE FROM "user" WHERE id = ${user.id}`;
  redirect("/sign-in?deleted=1");
}
