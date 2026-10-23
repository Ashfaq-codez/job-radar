# Multi-user job-radar

Branch: `multi-user` (not pushed, not deployed, nothing run against the database).
Built unattended on 2026-10-23. This file is the decision log, the security review, and your setup checklist.

---

## 1. What was built, file by file

### Database (`pipeline/src/db/schema.sql`, new block at the bottom)
- Better Auth tables `"user"`, `"session"`, `"account"`, `"verification"` (from Better Auth 1.7's built-in Postgres schema, camelCase columns, quoted).
- `invites`: invite-only allowlist (emails stored lowercase).
- `profiles`: one row per person (resume text, preferences, Discord webhook, consent, onboarding time).
- `user_jobs`: per-person view of a shared job: `matched`, `fit_score`, `fit_reasons`, `scored_at`, `status`, `status_changed_at`, `opened_at`, `notified_at`, `notes`, plus indexes for the dashboard queries.
- `jobs.role_family` and `companies.added_by_user`.
- The old per-user columns on `jobs` (`fit_score`, `fit_reasons`, `scored_at`, `status`, `status_changed_at`, `notes`, `opened_at`, `notified_at`) are **kept**. Nothing reads or writes them any more; drop them once you've verified the migration (SQL in section 5).

### Pipeline
| File | What |
|---|---|
| `src/classify.ts` | New `roleFamily` (8 families + `other`) from the title, with a description fallback for vague titles ("Graduate Trainee"). `isSeniorTitle()`. Category/employment/seniority/minYears unchanged. |
| `src/location.ts` | Indian cities + aliases, `isIndiaLocation()`, `matchesLocation()`. |
| `src/match.ts` | `matchesProfile(job, profile)`, pure. |
| `src/match.test.ts` | 70 tests: role families (incl. analyst look-alikes), locations, matching. |
| `src/filters.ts` | India filter now uses the city list (was Bengaluru/India only). |
| `src/db/jobs.ts` | Upsert saves `role_family`. Old single-user queries removed. |
| `src/db/users.ts` | Per-user queries: active profiles, open jobs, `syncMatches`, unscored jobs, save score, notify queries. |
| `src/scoring/score.ts` | Prompt built from each person's preferences + resume (stable per-person prefix first, for prompt caching). |
| `src/scoring/fit.ts` | `FitSchema` on its own (importable without an OpenAI key). |
| `src/scoring/run.ts` | `matchAndScore()`: match every onboarded person, then score up to 150/person and `MAX_SCORES_PER_RUN` (default 400) overall, shared fairly. |
| `src/notify/discord.ts` | Per-person alerts: their webhook (the owner falls back to `DISCORD_WEBHOOK_URL`), their `min_notify_score`, `user_jobs.notified_at`. |
| `src/notify/format.ts` | `isDiscordWebhook()` guard (+ tests). |
| `src/scripts/migrate-owner.ts` | `npm run migrate-owner`: copies your per-user columns into `user_jobs`, creates your profile from `data/resume.md`. Idempotent, prints counts only. |
| `src/scripts/reclassify.ts` | Also fills `role_family`. |
| `src/sources/workday.ts` | Fetches descriptions for every role family, not just developer roles. |
| `src/index.ts` | Steps 6–7 are now per-person match → score → alert. `printTopMatches` was removed (it was single-user). |
| `.github/workflows/pipeline.yml` | Removed the resume step (resumes live in the DB now). Added `OWNER_EMAIL` secret and optional `MAX_SCORES_PER_RUN` variable. |

### Dashboard
| File | What |
|---|---|
| `lib/auth.ts` | Better Auth: Google only, Neon `Pool`, invite check in `user.create.before` **and** `session.create.before` hooks. |
| `lib/auth-client.ts` | Browser client (sign in / sign out). |
| `lib/session.ts` | Data access layer: `getCurrentUser` (re-checks the invite on every request), `requireUser`, `requireOnboardedUser`, `requireOwner`, `actionUser`. |
| `proxy.ts` | Next 16 "proxy" (was middleware): no session cookie → `/sign-in`. Only a fast filter; the real checks are in `lib/session.ts`. |
| `app/api/auth/[...all]/route.ts` | Better Auth endpoints. Google callback: `/api/auth/callback/google`. |
| `app/sign-in/*` | Sign-in page, "You need an invite" view, "account deleted" note. |
| `app/onboarding/page.tsx` | Step 1 resume + consent, step 2 preferences. Required until `onboarded_at` is set. |
| `app/(app)/…` | Existing pages moved into a route group so sign-in/onboarding don't show the sidebar. All queries take the user id. |
| `app/(app)/settings/page.tsx` | Preferences, re-upload resume, test alert, sign out, delete account. |
| `app/(app)/admin/invites/page.tsx` | Owner only: invite/remove emails, see who signed up and onboarded. |
| `app/actions.ts` | Every action calls `actionUser()` and writes only `WHERE user_id = <caller>`. Add company records `added_by_user`. |
| `app/profile-actions.ts` | Upload resume, save profile, test alert, delete account. |
| `app/admin-actions.ts` | Add/remove invites, owner only. |
| `lib/jobs.ts` | Every query joins `user_jobs` for the signed-in user; "target roles" = `uj.matched`. |
| `lib/profile.ts`, `lib/profile-options.ts` | Profile Zod schema, save/load, choices (client-safe file has no secrets). |
| `lib/resume.ts` | PDF (unpdf) / DOCX (mammoth) → text. 5 MB, magic-byte check, ≤10 PDF pages. |
| `lib/ai.ts` | One structured-output call to pre-fill skills, grad year, level, families, titles. |
| `app/components/user-menu.tsx`, `sign-out-button.tsx` | Name/avatar, Settings, Admin (owner), Sign out. |
| `app/components/profile/*`, `invites.tsx` | Forms. |
| `next.config.ts` | `serverActions.bodySizeLimit: "6mb"` for resume uploads. |
| `.env.example` | Names of every dashboard env var. `.gitignore` now allows this one file. |

New dashboard packages: `better-auth@1.7.12`, `unpdf@1.9.1`, `mammoth@1.13.0`, `openai@^7.41` (all free/open source).

---

## 2. Decisions (and why)

1. **Better Auth over Auth.js.** As asked. I couldn't confirm "Auth.js is in maintenance under Better Auth" from the installed packages or npm metadata (next-auth's npm description doesn't say), so treat that as unverified. Better Auth 1.7.12's own types were used for everything.
2. **Database adapter: Neon's `Pool`** passed straight to Better Auth (it accepts any pg-compatible pool via Kysely). No extra driver needed.
3. **Better Auth tables written by hand** from Better Auth's `getAuthTables()` output, because its CLI generator needs a live database connection (not allowed in this run).
4. **Invite check in two hooks**: `user.create.before` blocks new sign-ups, `session.create.before` blocks existing accounts whose invite was removed, and `getCurrentUser()` re-checks on every request so removal takes effect immediately. A blocked Google sign-in lands on `/sign-in?error=NOT_INVITED`.
5. **Consent comes before the resume upload** (step 1), not on step 2, because the upload step already sends the resume to OpenAI for pre-filling. The exact consent text you gave is used.
6. **Matching lives in the pipeline only.** The pipeline writes a `user_jobs` row for every matching open job (`matched = true`) and flips `matched = false` when a job stops fitting. The dashboard just reads `user_jobs`. Trade-off: **a new user sees no jobs until the next pipeline run** (twice a day, or run the workflow manually). The empty state says so. Keeping one implementation avoids the TS logic drifting between two packages.
7. **Rows are never deleted when a profile changes**, only flagged `matched = false`, so scores, statuses and notes survive. The Applied board ignores `matched` (it shows anything you tracked).
8. **"Sales Analyst" → `other`.** Analyst titles with sales/finance/credit/security/risk/KYC/audit words are `other`; "Business Analyst - Finance" is also `other`. "Data Analyst - Finance" stays `data_analyst` because it says "data". Marketing titles are always `other`.
9. **Description fallback for role family** only for vague titles (trainee/graduate/intern/associate/analyst/engineer/developer/fresher), only if ≥3 keyword hits, and never for non-tech titles.
10. **Location rules**: relocation never means abroad; "Remote India" must be picked to get remote jobs; a location that says only "India" (e.g. Workday's "3 Locations (India)") matches everyone, since it may include their city.
11. **What filters vs. what only informs the AI.** Filters: role family/extra titles, job type, location, min years, senior title words, avoid keywords (title + first 4,000 chars of description), avoid companies. Prompt-only (job posts don't say these reliably): work mode, company types, notice period, salary, skills, grad year.
12. **Experience levels → max years**: Fresher 1, <1 1, 1–2 2, 2–3 3, 3+ 5 (as specified). Matching uses `isSeniorTitle(title)` plus `min_years`, not the stored `seniority` label, so someone with 3+ years can see a "3+ years" role.
13. **Scoring budget shared fairly**: each person gets `min(150, ceil(remaining / people left))`.
14. **The pipeline no longer reads `data/resume.md`**; only `migrate-owner` does (once). The `RESUME_MD` GitHub secret is now unused; you can delete it.
15. **`MIN_NOTIFY_SCORE` env is gone**; each person sets "Alert from score" in Settings (default 70).
16. **Public logs**: people appear as "user 2 of 3". No names, emails, resume text, AI reasons or webhook URLs are printed. Scoring errors print only the error type and HTTP status.
17. **Discord webhooks are validated** (`https://discord.com/api/webhooks/<id>/<token>` and the ptb/canary/discordapp variants) both when saved and before every send, so a saved value can't make the server or pipeline call another address. Settings shows only "Connected (…last4)".
18. **Owner can't delete their own account from Settings** (it would remove the admin). Everyone else can; this deletes their `user_jobs`, `profile`, sessions and accounts, and keeps their invite (so they could come back). Companies they added stay, with `added_by_user` set to NULL.
19. **Companies**: anyone can add. Remove is allowed for whoever added it, or the owner. The badge says "Added by you" or "Added by a user".
20. **Resume files are never stored**; text is capped at 30,000 characters. PDF over 10 pages and image-only PDFs are rejected with a friendly message.
21. **Model constant duplicated** in `dashboard/lib/ai.ts` (`gpt-5.4-nano`) because the two packages can't import each other; comment says to keep them in sync.
22. **Pages moved into `app/(app)/`** (a route group, doesn't change URLs) so sign-in and onboarding render without the sidebar.
23. **Intermediate commits**: the pipeline commit "role families, …" doesn't typecheck on its own (it removed queries the next commit replaces). The branch tip is clean. Squash if you prefer.

---

## 3. Your setup checklist (in order)

### A. Google OAuth client (Google Cloud Console, free)
1. Go to https://console.cloud.google.com → top bar project picker → **New project** → name it `job-radar` → Create, then select it.
2. Left menu → **APIs & Services → OAuth consent screen** (may be called "Google Auth Platform → Branding/Audience").
   - User type: **External** → Create.
   - App name `job-radar`, your email as support and developer contact → Save.
   - Scopes: you don't need to add any (Better Auth asks for the basic `openid email profile`).
   - **Audience / Test users**: add your Gmail and your friend's Gmail. While the app is in "Testing", only test users can sign in (max 100). That's fine for invite-only.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**, name `job-radar web`.
   - **Authorized JavaScript origins**: `http://localhost:3000` and later `https://<your-app>.vercel.app`.
   - **Authorized redirect URIs** (exact):
     - `http://localhost:3000/api/auth/callback/google`
     - `https://<your-app>.vercel.app/api/auth/callback/google`
   - Create → copy the **Client ID** and **Client secret**.

Note: your dev server runs with `-H 127.0.0.1`. Open it as **http://localhost:3000** (not 127.0.0.1) so the cookie domain matches `BETTER_AUTH_URL`, or set both to `http://127.0.0.1:3000` and add that redirect URI too.

### B. Environment variables (names only)
**`dashboard/.env.local`** (see `dashboard/.env.example`):
`DATABASE_URL`, `BETTER_AUTH_SECRET` (run `openssl rand -base64 32`), `BETTER_AUTH_URL` (`http://localhost:3000`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_EMAIL`, `OPENAI_API_KEY`, optional `DISCORD_WEBHOOK_URL`.

**`pipeline/.env`** (see `pipeline/.env.example`):
`DATABASE_URL`, `OPENAI_API_KEY`, `OWNER_EMAIL`, `DISCORD_WEBHOOK_URL`, optional `MAX_SCORES_PER_RUN`. (`MIN_NOTIFY_SCORE` is no longer used.)

**Vercel** (Project → Settings → Environment Variables), when you deploy:
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (= your Vercel URL), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_EMAIL`, `OPENAI_API_KEY`, optional `DISCORD_WEBHOOK_URL`.

**GitHub** (repo → Settings → Secrets and variables → Actions):
- Secrets: `DATABASE_URL`, `OPENAI_API_KEY`, `DISCORD_WEBHOOK_URL`, **`OWNER_EMAIL` (new)**. `RESUME_MD` can be deleted.
- Variables tab (optional): `MAX_SCORES_PER_RUN`.

### C. SQL in Neon (SQL Editor), in order
1. If you haven't yet, the earlier blocks: `notified_at`, `min_years`, `experience_text`, `opened_at` (they're above the multi-user block in `schema.sql`; all `IF NOT EXISTS`, safe to re-run).
2. The whole **"Multi-user"** block at the bottom of `pipeline/src/db/schema.sql`, top to bottom (Better Auth tables → invites → profiles → user_jobs → `jobs.role_family` → `companies.added_by_user`). It's all idempotent.

### D. First run
1. `cd dashboard && npm install` (new packages), then start your dev server as usual.
2. Open http://localhost:3000 → you're sent to **/sign-in** → Continue with Google → pick your `OWNER_EMAIL` account.
3. You'll land on **/onboarding**. Don't fill it in yet; first:
4. `cd pipeline && npm run migrate-owner`. It prints counts like "Copied 412 job rows… Created your profile from resume.md".
5. Refresh the dashboard. You should go straight to Overview, with your old applications on the Applied board.
6. Open **Settings** and check your preferences (it defaulted to Software development, Fresher, Bengaluru, both job types). Add skills if you like and Save.
7. `npm run reclassify` (fills `role_family` for existing jobs and prints the seniority summary).
8. `npm run dev` in `pipeline/`. You should see "Matching N open jobs for 1 users…" and per-user scoring, then a Discord alert if there are new strong matches.

### E. Inviting your friend
1. Dashboard → your avatar card → **Admin** → enter their Gmail → Invite.
2. Make sure the same Gmail is a **Test user** on the Google consent screen (step A.2).
3. Send them the URL (once deployed; for now it's only on your machine).

### F. How they onboard
Sign in with Google → tick consent → upload PDF/DOCX → check the pre-filled roles/skills → pick locations etc. → **Finish**. Their jobs appear after the next pipeline run: run the **Pipeline** workflow manually from GitHub Actions to skip the wait.

### G. What to verify
- [ ] A non-invited Google account gets "You need an invite".
- [ ] Removing an invite signs that person out on their next page load.
- [ ] Your Applied board, notes and scores match what you had before.
- [ ] Your friend can't see your jobs: open one of your job links (`/jobs?job=<id>`) in their session; the panel shouldn't open.
- [ ] Settings → "Send test alert" posts to Discord.
- [ ] Pipeline logs in GitHub Actions show "user 1 of 2", no emails or names.
- [ ] Your friend deleting their account removes their row from Admin → People.
- [ ] After a week of it working, drop the old columns (section 5).

---

## 4. Security self-review

| Check | Status |
|---|---|
| Every page requires a session | `proxy.ts` redirects when there's no cookie; every page's data component calls `requireOnboardedUser`/`requireUser`/`requireOwner`, which validate the session in the DB. |
| Every server action re-checks the session | `actions.ts`, `profile-actions.ts`, `admin-actions.ts`: each starts with `actionUser()` (throws if signed out or no longer invited). |
| Row ownership | All writes to `user_jobs` are `WHERE user_id = <caller> AND job_id = …`. `getJob` reads through the caller's `user_jobs`, so another person's job id returns nothing. Profile writes are `WHERE user_id = <caller>`. Company removal requires `added_by_user = caller` or owner. |
| Admin is owner-only | Page uses `requireOwner()`; both admin actions call `ownerOnly()`. Owner = `OWNER_EMAIL`, compared lowercase. |
| Invite-only enforced server-side | Better Auth DB hooks on user create and session create, plus `getCurrentUser()` on every request. |
| Input validation | Zod on every action input (status enum, job id, profile form, invite email, delete confirmation, company URL). SQL only via tagged templates. |
| Secrets/PII in logs | Pipeline logs "user i of n" only; errors print the error type/status. Dashboard logs `err.name` only for resume/AI failures. Webhook URLs are never logged or returned. |
| Secrets in client bundles | `lib/auth.ts`, `lib/session.ts`, `lib/profile.ts`, `lib/resume.ts`, `lib/ai.ts`, `lib/jobs.ts`, `lib/db.ts` all `import "server-only"`. Client components only import `lib/profile-options.ts` (plain data) and `lib/auth-client.ts`. `ProfileView` sent to the client excludes resume text and the webhook URL. |
| Uploads | `bodySizeLimit` 6 MB, then a 5 MB check, magic bytes (PDF/ZIP), ≤10 PDF pages, text capped at 30k chars, file never stored. |
| SSRF | Webhooks must match the Discord webhook pattern before saving and before every send (dashboard and pipeline). Add-company still goes through the existing `safeFetch` private-IP checks. |
| CSRF | Next's server-action Origin check; Better Auth's own origin checks for `/api/auth`. |

Residual risks:
- A malicious `.docx` could be a zip bomb (mammoth unzips it in memory). Only invited people can upload; acceptable for now.
- No rate limit on resume uploads (each one costs one cheap OpenAI call). Invite-only keeps this small.
- The last 4 characters of a webhook token are shown in Settings (as specified).
- `npm audit` reports 5 high-severity issues in ESLint's dev dependencies (`braces` via `eslint-config-next`). They were there before this branch and only affect linting, not the app.

---

## 5. Unfinished / next steps

- **Nothing has run against a real database or Google.** Typecheck, unit tests, lint and `next build` pass; the flows above are untested end to end.
- **Drop the old per-user columns on `jobs`** once verified:
  ```sql
  ALTER TABLE jobs DROP COLUMN IF EXISTS fit_score, DROP COLUMN IF EXISTS fit_reasons,
    DROP COLUMN IF EXISTS scored_at, DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS status_changed_at,
    DROP COLUMN IF EXISTS notes, DROP COLUMN IF EXISTS opened_at, DROP COLUMN IF EXISTS notified_at;
  ```
  Also drop the old `jobs_notify_idx` index (it's on `jobs.fit_score`).
- **New users wait for the next pipeline run** to see jobs. A "Find my matches now" button would need the matcher shared with the dashboard (or a GitHub `workflow_dispatch` trigger from the dashboard).
- **`jobs.category = 'developer'`** is still computed but no longer used by the dashboard; `role_family` replaced it.
- **The dashboard's Jobs filters** still offer the old city list (it filters by text, so it works); they could reuse the profile's cities.
- **Owner's "Send test alert"** only works from the dashboard if `DISCORD_WEBHOOK_URL` is also set in the dashboard env, or you save a webhook in Settings.
- Ideas: Gmail job-alert parsing (free via Gmail API), weekly digest email, an admin view of pipeline cost per user, publishing the Google app ("In production") once you have more than ~10 users.
