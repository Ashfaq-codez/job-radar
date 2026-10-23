"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { STATUSES, type Status } from "@/lib/jobs";

function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export async function setStatus(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const status = formData.get("status");

  // Server actions are public endpoints: never trust what the form sends
  if (typeof id !== "string" || !isStatus(status)) {
    throw new Error("Invalid status update");
  }

  await sql`
    UPDATE jobs SET status = ${status}, status_changed_at = now()
    WHERE id = ${id}
  `;
  revalidatePath("/"); // re-render the page with fresh data
}