# job-radar

Personal job-search pipeline (`pipeline/`) and dashboard (`dashboard/`) for entry-level developer roles in Bengaluru.

## How it runs

Two GitHub Actions workflows run the pipeline on their own:

| Workflow | What it does | When (IST) |
|---|---|---|
| `pipeline.yml` | Fetches jobs from every tracked board, saves new India jobs to Neon, matches them to each user's profile, scores new matches against that user's resume with OpenAI, and sends each user's strong matches to their Discord. | Every day at 7:47 am and 7:47 pm |
| `discover.yml` | Finds new company job boards via Common Crawl and checks which have India jobs. | Sundays at 8:47 pm |

Both can also be started by hand from the **Actions** tab (**Run workflow**). Times are off the hour because GitHub often delays jobs scheduled exactly on the hour.

Required repository secrets (Settings → Secrets and variables → Actions):

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `DISCORD_WEBHOOK_URL` (the owner's alerts)
- `OWNER_EMAIL`

Optional repository variable: `MAX_SCORES_PER_RUN` (default 400).

Resumes now live in the database (each user uploads theirs in the dashboard). Logs are public, so the pipeline never prints names, emails, resume text or AI reasons: users appear as "user 2 of 3". See `docs/MULTI_USER.md`.
