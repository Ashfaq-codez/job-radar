import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requireOnboardedUser } from "@/lib/session";
import { getBoard, getInsights, getOpenedPending, getOverview, getTopMatches } from "@/lib/jobs";
import { prettyCompany, scoreColor, timeAgo } from "@/lib/format";
import { BarList, ColumnChart } from "@/app/components/charts";
import { JobCard } from "@/app/components/job-card";
import { Empty, StatusPill } from "@/app/components/ui";
import { CompanyLogo } from "@/app/components/company-logo";
import { DidYouApply } from "@/app/components/apply-confirm";

function HeroStat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-white/20">
      <dd className="text-3xl font-bold tracking-tight tabular-nums">{value}</dd>
      <dt className="mt-1 text-xs font-medium text-white/80">{label}</dt>
    </Link>
  );
}

// Greeting by the time of day in India, where the job hunt happens
function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function Card({ title, subtitle, children, action, tint = "bg-interview ring-interview-soft" }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode; tint?: string }) {
  return (
    <section className="rounded-3xl border border-rule bg-surface p-5 shadow-card">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <span aria-hidden="true" className={`size-2.5 rounded-full ring-4 ${tint}`} />
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-faint">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const dayFmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });

async function OverviewContent() {
  await connection();
  const user = await requireOnboardedUser();
  const [o, top, board, ins, opened] = await Promise.all([
    getOverview(user.id), getTopMatches(user.id, 6), getBoard(user.id), getInsights(user.id), getOpenedPending(user.id),
  ]);
  const inProgress = board.filter((j) => j.status !== "rejected" && j.status !== "saved").slice(0, 5);
  const newThisWeek = ins.perDay.slice(-7).reduce((s, d) => s + d.n, 0);

  return (
    <>
      <section className="hero-gradient relative overflow-hidden rounded-3xl p-6 text-white shadow-lift sm:p-8">
        <p className="text-sm font-medium text-white/75">{greeting()} <span className="wave">👋</span></p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          {o.newToday > 0 ? `${o.newToday} new roles landed today` : "Let’s find your next role"}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          {o.strong > 0
            ? `${o.strong} strong matches are waiting. Every application is a step closer.`
            : "Every application is a step closer. Keep the streak going."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/jobs?score=80" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-accent shadow-card transition-transform hover:-translate-y-0.5">
            Review strong matches →
          </Link>
          <Link href="/jobs" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/40 transition-colors hover:bg-white/10">
            Browse all
          </Link>
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <HeroStat href="/jobs?posted=1" label="New today" value={o.newToday} />
          <HeroStat href="/jobs?score=80" label="Strong matches" value={o.strong} />
          <HeroStat href="/jobs" label="To review" value={o.toReview} />
          <HeroStat href="/applied" label={`Active · ${o.interviewing} interviewing`} value={o.active} />
        </dl>
      </section>

      {opened.length > 0 && (
        <section aria-labelledby="did-you-apply-heading" className="mt-6 rounded-3xl border border-rule bg-surface p-5 shadow-card">
          <h2 id="did-you-apply-heading" className="flex items-center gap-2 text-sm font-bold">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-accent ring-4 ring-accent-soft" />
            Did you apply?
          </h2>
          <p className="mt-0.5 text-xs text-faint">Roles you opened on the company site this week</p>
          <ul className="mt-4 divide-y divide-rule">
            {opened.map((job) => (
              <li key={job.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <CompanyLogo company={job.company} url={job.url} />
                <div className="min-w-0 flex-1">
                  <DidYouApply job={job} />
                  <p className="mt-0.5 text-xs text-faint">
                    Opened {timeAgo(job.opened_at)} ·{" "}
                    <Link href={`/jobs?job=${encodeURIComponent(job.id)}`} className="text-accent hover:underline">Details</Link>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card tint="bg-interview ring-interview-soft" title="New roles per day" subtitle={`${newThisWeek} in the last 7 days`}>
          <ColumnChart
            data={ins.perDay.map((d) => ({ key: d.day, n: d.n }))}
            label={(day, i) => (i % 3 === 1 || i === 13 ? dayFmt.format(new Date(day)) : null)}
            tip={(d) => `${dayFmt.format(new Date(d.key))}: ${d.n} roles`}
          />
        </Card>
        <Card tint="bg-offer ring-offer-soft" title="How well roles fit" subtitle={`${ins.scoredJobs} scored roles, by fit score`}>
          <ColumnChart
            data={ins.scores.map((s) => ({ key: String(s.from), n: s.n }))}
            label={(from) => from}
            tip={(d) => `${d.key}–${Number(d.key) + 9}: ${d.n} roles`}
            color={(from) => scoreColor(Number(from) + 5).text}
          />
        </Card>
        <Card tint="bg-applied ring-applied-soft" title="Top hiring companies" subtitle="Open roles waiting for review">
          {ins.companies.length > 0 ? (
            <BarList
              data={ins.companies.map((c) => ({ label: prettyCompany(c.company), n: c.n, href: `/jobs?q=${encodeURIComponent(c.company)}` }))}
              tip={(n) => `${n} open roles`}
            />
          ) : (
            <p className="text-sm text-muted">No open roles yet.</p>
          )}
        </Card>
        <Card tint="bg-rejected ring-rejected-soft" title="Skills you’re missing most" subtitle="How many scored roles flag each gap">
          {ins.skills.length > 0 ? (
            <BarList data={ins.skills.map((s) => ({ label: s.skill, n: s.n }))} tip={(n) => `Flagged in ${n} roles`} />
          ) : (
            <p className="text-sm text-muted">Appears once roles are scored.</p>
          )}
        </Card>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-[1fr_20rem]">
        <section aria-labelledby="top-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="top-heading" className="text-sm font-medium">Top matches</h2>
            <Link href="/jobs" className="text-sm text-accent hover:underline">View all {o.toReview} →</Link>
          </div>
          {top.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {top.map((job) => (
                <li key={job.id}><JobCard job={job} href={`/jobs?job=${encodeURIComponent(job.id)}`} /></li>
              ))}
            </ul>
          ) : (
            <Empty title="No scored roles yet">Run the pipeline to fetch and score jobs.</Empty>
          )}
        </section>

        <section aria-labelledby="progress-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="progress-heading" className="text-sm font-medium">In progress</h2>
            <Link href="/applied" className="text-sm text-accent hover:underline">Board →</Link>
          </div>
          {inProgress.length > 0 ? (
            <ul className="divide-y divide-rule rounded-2xl border border-rule bg-surface shadow-card">
              {inProgress.map((job) => (
                <li key={job.id}>
                  <Link href={`/applied?job=${encodeURIComponent(job.id)}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle/60">
                    <CompanyLogo company={job.company} url={job.url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{job.title}</p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                        <StatusPill status={job.status} />
                        <span className="truncate">{prettyCompany(job.company)}</span>
                        <span className="ml-auto shrink-0 text-faint">{timeAgo(job.status_changed_at)}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Apply to a role and it shows up here.</Empty>
          )}
        </section>
      </div>
    </>
  );
}

export default function OverviewPage() {
  return (
    <>
      <Suspense fallback={<div className="hero-gradient h-80 animate-pulse rounded-3xl" />}>
        <OverviewContent />
      </Suspense>
    </>
  );
}
