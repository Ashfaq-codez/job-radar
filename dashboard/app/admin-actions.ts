"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ownerEmail } from "@/lib/auth";
import { sql } from "@/lib/db";
import { actionUser } from "@/lib/session";

// Owner-only. Each action re-checks that the caller is the owner.

export type InviteState = { tone: "success" | "error"; message: string } | null;

const Email = z.string().trim().toLowerCase().email("That doesn't look like an email address.").max(254);

async function ownerOnly() {
  const user = await actionUser();
  if (!user.isOwner) throw new Error("Only the owner can manage invites");
  return user;
}

export async function addInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const owner = await ownerOnly();
  const email = Email.safeParse(formData.get("email"));
  if (!email.success) return { tone: "error", message: email.error.issues[0]?.message ?? "Invalid email." };
  if (email.data === ownerEmail()) return { tone: "error", message: "That's you. The owner is always allowed." };

  const rows = await sql`
    INSERT INTO invites (email, invited_by) VALUES (${email.data}, ${owner.email})
    ON CONFLICT (email) DO NOTHING RETURNING email`;
  revalidatePath("/admin/invites");
  return rows.length
    ? { tone: "success", message: `Invited ${email.data}. They can now sign in with that Google account.` }
    : { tone: "error", message: `${email.data} is already invited.` };
}

// Removing an invite locks the person out right away (their data stays until they or you delete it)
export async function removeInvite(email: unknown): Promise<void> {
  await ownerOnly();
  const parsed = Email.safeParse(email);
  if (!parsed.success) throw new Error("Invalid email");
  await sql`DELETE FROM invites WHERE email = ${parsed.data}`;
  revalidatePath("/admin/invites");
}
