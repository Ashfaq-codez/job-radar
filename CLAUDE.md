# job-radar

Personal job-search pipeline + dashboard for an entry-level software developer in Bengaluru.
I'm a 2025 CSE grad learning while building: explain what you changed and why, briefly.

## Structure
- `pipeline/`: TypeScript (Node, ES modules, run with tsx). Fetches jobs, stores in Neon, scores with OpenAI.
  - `src/sources/`: one file per job source (greenhouse, lever, ashby, workday, careers). Pattern: Zod schema → fetch → parse → map to `Job`.
  - `src/sources/index.ts`: `fetchers` map, keyed by `BoardSource`.
  - `src/classify.ts`: rule-based role labels (category/employment/seniority), unit-tested in `classify.test.ts`.
  - `src/db/`: Neon queries via `@neondatabase/serverless` tagged templates (`sql\`...\``).
  - `src/discover/`: Common Crawl board discovery.
  - `src/db/schema.sql`: source of truth for the schema. Changes are `ALTER TABLE ... IF NOT EXISTS` appended at the bottom; I run them manually in Neon's SQL Editor.
- `dashboard/`: Next.js 16 App Router, Cache Components enabled, Tailwind v4.
  - Data in `lib/jobs.ts` (`import "server-only"`), server actions in `app/actions.ts`.
  - Pages wrap live data in `<Suspense>` and call `await connection()`. Never `export const dynamic`.
  - Filters/state live in URL search params.

## Rules
- Free-tier services only. Never add paid APIs.
- Never read, print, or commit `.env`, `.env.local`, or `pipeline/data/resume.md`.
- Imports in `pipeline/` use `.js` extensions (NodeNext). Use `import type` for types.
- Validate all external data with Zod at the boundary. Validate all server-action input.
- SQL only through tagged templates (parameterized). No string-built SQL.
- Dashboard styling: use the theme tokens in `app/globals.css` (canvas, surface, ink, muted, rule, strong/mid/low, accent, and the `*-soft` pastels). Light theme only. No hardcoded hex colors in components.
- Accessibility: visible focus styles, labels on inputs, external links use `target="_blank" rel="noopener noreferrer"`.
- After changes run: `cd pipeline && npm run typecheck && npm test` and `cd dashboard && npx tsc --noEmit`.
- Don't commit. I review `git diff` and commit myself.