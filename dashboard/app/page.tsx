import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";

type Fit = {
  verdict: "apply" | "maybe" | "skip";
  reasons: string[];
  missing: string[];
};

function parseFit(raw: string | null): Fit | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Fit;
  } catch {
    return null;
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 50) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-600";
}

// The live part: queries Neon on every visit
async function MatchList() {
  await connection(); // "this needs a real request; never pre-build it"

  const jobs = await sql`
    SELECT id, company, title, location, url, fit_score, fit_reasons
    FROM jobs
    WHERE fit_score IS NOT NULL
      AND last_seen_at > now() - interval '3 days'
    ORDER BY fit_score DESC
    LIMIT 50
  `;

  return (
    <>
      <p className="mb-6 text-sm text-gray-500">{jobs.length} scored matches, best first</p>

      <ul className="space-y-4">
        {jobs.map((job) => {
          const fit = parseFit(job.fit_reasons);
          return (
            <li key={job.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{job.title}</p>
                  <p className="text-sm text-gray-500">
                    {job.company} · {job.location}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${scoreColor(job.fit_score)}`}>
                  {job.fit_score}
                </span>
              </div>

              {fit && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {fit.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              )}

              {fit && fit.missing.length > 0 && (
                <p className="mt-2 text-sm text-red-600">Missing: {fit.missing.join(", ")}</p>
              )}

              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                Open job →
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// The page: the heading shows instantly, the list streams in
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">job-radar</h1>
      <Suspense fallback={<p className="text-sm text-gray-500">Loading matches…</p>}>
        <MatchList />
      </Suspense>
    </main>
  );
}