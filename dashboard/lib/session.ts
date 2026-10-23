import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, isInvited, ownerEmail } from "./auth";
import { sql } from "./db";

// The data access layer for "who is this?". Pages AND server actions call these;
// the proxy's cookie check is only a fast first filter, never the real check.

export type CurrentUser = { id: string; email: string; name: string; image: string | null; isOwner: boolean };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, email, name, image } = session.user;
  // Removing an invite locks someone out right away, not only at their next sign-in
  if (!(await isInvited(email))) return null;
  return { id, email, name, image: image ?? null, isOwner: email.toLowerCase() === ownerEmail() };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export const isOnboarded = cache(async (userId: string): Promise<boolean> => {
  const rows = await sql`SELECT 1 FROM profiles WHERE user_id = ${userId} AND onboarded_at IS NOT NULL`;
  return rows.length > 0;
});

// For app pages: signed in AND finished onboarding
export async function requireOnboardedUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!(await isOnboarded(user.id))) redirect("/onboarding");
  return user;
}

export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isOwner) redirect("/");
  return user;
}

// For server actions: throw instead of redirecting, so a forged request just fails
export async function actionUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return user;
}
