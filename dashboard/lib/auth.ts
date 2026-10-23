import "server-only";
import { Pool } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { sql } from "./db";

// Google sign-in only, invite-only. Sessions live in Postgres (the "session" table).

export const ownerEmail = () => process.env.OWNER_EMAIL?.trim().toLowerCase() || null;

export async function isInvited(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (e === ownerEmail()) return true;
  const rows = await sql`SELECT 1 FROM invites WHERE email = ${e}`;
  return rows.length > 0;
}

// Shown on /sign-in?error=NOT_INVITED. Better Auth redirects there when a hook throws.
const notInvited = () => new APIError("FORBIDDEN", { code: "NOT_INVITED", message: "This email hasn't been invited." });

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      prompt: "select_account",
    },
  },
  onAPIError: { errorURL: "/sign-in" },
  databaseHooks: {
    // New accounts: only invited emails
    user: {
      create: {
        before: async (user) => {
          if (!(await isInvited(user.email))) throw notInvited();
        },
      },
    },
    // Every sign-in: the invite may have been removed since the account was made
    session: {
      create: {
        before: async (session) => {
          const [u] = await sql`SELECT email FROM "user" WHERE id = ${session.userId}`;
          if (!u || !(await isInvited(String(u.email)))) throw notInvited();
        },
      },
    },
  },
  plugins: [nextCookies()], // lets server actions set auth cookies; must be last
});
