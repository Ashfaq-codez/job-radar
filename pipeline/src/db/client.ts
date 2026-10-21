import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL is missing. Is pipeline/.env there, and does the dev script use --env-file?"
  );
}

export const sql = neon(url);