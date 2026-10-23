import Link from "next/link";
import type { JobDetail } from "@/lib/jobs";
import { parseFit, prettyCompany, timeAgo } from "@/lib/format";
import { LockPageScroll, NotesEditor, PanelControls, PanelNav } from "./panel-controls";
import { RoleBadges, Score, StatusPill } from "./ui";
import { CompanyLogo } from "./company-logo";

export type PanelNavHrefs = { closeHref: string; prevHref: string | null; nextHref: string | null };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-medium uppercase tracking-wide text-faint">{title}</h3>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export function JobPanel({ job, nav }: { job: JobDetail; nav: PanelNavHrefs }) {
  const fit = parseFit(job.fit_reasons);
  const triage = job.status === "new" || job.status === "saved";

  return (
    <>
      <LockPageScroll />
      {/* Clicking the dimmed background closes the panel */}
      <Link href={nav.closeHref} scroll={false} aria-label="Close details" className="animate-fade-in fixed inset-0 z-40 bg-ink/20" />

      <aside
        aria-labelledby="job-panel-title"
        className="animate-slide-in fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col overflow-x-hidden border-l border-rule bg-surface shadow-lift"
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-rule px-6">
          <div className="ml-auto"><PanelNav nav={nav} /></div>
        </div>

        <div key={job.id} className="scroll-quiet animate-fade-in min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="space-y-8 px-6 py-6 sm:px-8">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <CompanyLogo company={job.company} url={job.url} size="lg" />
                  <p className="text-sm font-semibold text-muted">{prettyCompany(job.company)}</p>
                </div>
                <h2 id="job-panel-title" className="mt-4 text-xl font-semibold leading-snug tracking-tight">
                  {job.title}
                </h2>
                <p className="mt-1.5 text-sm text-muted">
                  {job.location} <span className="text-faint">·</span> found {timeAgo(job.first_seen_at)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <RoleBadges job={job} />
                  {job.status !== "new" && <StatusPill status={job.status} />}
                </div>
              </div>
              <Score score={job.fit_score} size="lg" />
            </div>

            <PanelControls job={job} nav={nav} />

            {!triage && <NotesEditor key={job.id} id={job.id} initial={job.notes} />}

            {fit ? (
              <div className="grid gap-6 rounded-2xl bg-canvas p-5 sm:grid-cols-[3fr_2fr]">
                <Section title="Why this score">
                  <ul className="space-y-2 text-sm leading-relaxed">
                    {fit.reasons.map((reason, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-faint" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </Section>
                {fit.missing.length > 0 && (
                  <Section title="Not on your resume">
                    <ul className="flex flex-wrap gap-1.5">
                      {fit.missing.map((skill) => (
                        <li key={skill} className="rounded-md bg-rejected-soft px-2 py-1 text-xs leading-snug text-rejected">
                          {skill}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>
            ) : (
              <p className="rounded-2xl bg-canvas p-5 text-sm text-muted">Not scored yet. The AI scores new roles on the next pipeline run.</p>
            )}

            {(job.description_html || job.description) && (
              <Section title="Job description">
                {job.description_html ? (
                  <div className="job-prose" dangerouslySetInnerHTML={{ __html: job.description_html }} />
                ) : (
                  <p className="job-prose whitespace-pre-line">{job.description}</p>
                )}
              </Section>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
