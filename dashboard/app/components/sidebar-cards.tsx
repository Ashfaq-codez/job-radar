import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getMomentum } from "@/lib/jobs";

const DAILY_GOAL = 3;

// One practical nudge per day, rotating by the date in India
const TIPS = [
  "Copy 3–4 keywords from the job post into your resume summary. ATS filters love exact matches.",
  "Ask for a referral: a short LinkedIn note to an engineer at the company beats a cold apply.",
  "Follow up 7 days after applying. One polite line is enough.",
  "Pin your best project at the top of GitHub with a clear README and a live link.",
  "Apply within 48 hours of a post going up. Early applicants get read first.",
  "Quantify one bullet today: “cut load time 40%” beats “improved performance”.",
  "Practise one DSA problem and explain it out loud, like you would in an interview.",
  "Keep a ‘brag doc’: every project, fix and thing you learned. Interviews get easier.",
  "Tailor the first line of your resume to the role: frontend, backend or full-stack.",
  "Rejections are data, not verdicts. Note what the role wanted and keep going.",
  "Message one alum from your college working where you want to be.",
  "Ship something small this week and post about it. Recruiters notice builders.",
];

function SidebarCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 ${className}`}>{children}</section>;
}

async function DailyGoal() {
  const m = await getMomentum();
  const done = Math.min(m.today, DAILY_GOAL);
  const message =
    m.today >= DAILY_GOAL ? "Goal smashed! 🎉 Anything more is a bonus." : m.today > 0 ? "Nice start. Keep the momentum!" : "Small steps win. Start with one. 🌱";

  return (
    <SidebarCard>
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-side-muted">Today’s goal</h2>
        <span className="text-sm font-bold tabular-nums text-spark">
          {m.today}/{DAILY_GOAL}
        </span>
      </div>
      <div className="mt-3 flex gap-1.5" role="img" aria-label={`${m.today} of ${DAILY_GOAL} applications today`}>
        {Array.from({ length: DAILY_GOAL }, (_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < done ? "bg-spark" : "bg-white/15"}`} />
        ))}
      </div>
      <p className="mt-3 text-sm font-medium">{message}</p>
      <p className="mt-1 text-xs text-side-muted">{m.week} sent this week</p>
      {m.strong > 0 && (
        <Link
          href="/jobs?score=80"
          className="mt-3 flex items-center justify-between rounded-xl bg-spark px-3 py-2 text-sm font-bold text-side transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark"
        >
          {m.strong} strong matches <span aria-hidden="true">→</span>
        </Link>
      )}
    </SidebarCard>
  );
}

// Days since epoch in India time, so the tip changes at local midnight
function todayIndex(): number {
  return Math.floor((Date.now() + 5.5 * 3_600_000) / 86_400_000);
}

function SparkTip({ day }: { day: number }) {
  return (
    <SidebarCard className="bg-gradient-to-br from-spark/20 to-transparent">
      <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-spark">
        <span aria-hidden="true">✨</span> Spark of the day
      </h2>
      <p className="mt-2 text-sm leading-relaxed">{TIPS[day % TIPS.length]}</p>
    </SidebarCard>
  );
}

// Live cards read the clock and the database, so they render per request inside Suspense
async function LiveCards() {
  await connection();
  return (
    <>
      <DailyGoal />
      <SparkTip day={todayIndex()} />
    </>
  );
}

export function SidebarCards() {
  return (
    <div className="space-y-3">
      <Suspense fallback={<div className="h-56 animate-pulse rounded-2xl bg-white/[0.07]" />}>
        <LiveCards />
      </Suspense>
    </div>
  );
}
