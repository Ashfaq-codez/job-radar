import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/session";
import { first, type SP } from "@/lib/url";
import { GoogleSignIn } from "./google-sign-in";

export const metadata: Metadata = { title: "Sign in · job-radar" };

// Error codes arrive as ?error=... from Better Auth (or our NOT_INVITED hook)
const ERRORS: Record<string, { title: string; body: string }> = {
  NOT_INVITED: {
    title: "This account isn’t invited yet",
    body: "Job Radar is invite-only. Ask the owner to invite the exact Google account you used, or sign in with a different one.",
  },
  access_denied: {
    title: "Sign-in was cancelled",
    body: "You closed Google’s consent screen before finishing. Continue with Google when you’re ready.",
  },
  state_mismatch: {
    title: "Your sign-in session expired",
    body: "This can happen if the page was open for a while or in another tab. Please try again.",
  },
};
const FALLBACK = {
  title: "We couldn’t sign you in",
  body: "Something went wrong talking to Google. Please try again in a moment.",
};

const WORDS = ["first job.", "backend role.", "frontend role.", "data role."];
const ROLES = ["Software Engineer", "SDE I", "Frontend Developer", "Data Analyst", "Backend Engineer", "Graduate Engineer Trainee", "Full Stack Developer", "QA Engineer", "ML Engineer", "Associate Developer"];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-canvas p-3 sm:p-5">
      <div className="grid min-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-[2rem] border border-rule bg-surface shadow-lift sm:min-h-[calc(100dvh-2.5rem)] lg:grid-cols-[1.4fr_1fr]">
        <Story />
        <section className="flex items-center justify-center px-6 py-14 sm:px-12">
          <div className="w-full max-w-sm">{children}</div>
        </section>
      </div>
    </main>
  );
}

function Story() {
  return (
    <aside className="relative flex flex-col justify-between gap-10 overflow-hidden bg-side px-6 py-8 text-side-ink sm:p-12 lg:p-16">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-spark/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-24 size-[24rem] rounded-full bg-accent/30 blur-3xl" />

      <p className="relative font-black uppercase leading-none tracking-tighter text-3xl sm:text-4xl">
        Job<span className="text-spark">Radar</span>
      </p>

      <div className="relative">
        <h2 className="text-[clamp(2.75rem,11vw,4.5rem)] font-black leading-[1.05] tracking-tight lg:text-[clamp(4rem,6.2vw,8rem)]">
          Find your
          <span className="sr-only"> {WORDS[0]}</span>
          <span aria-hidden="true" className="relative block h-[1.15em] overflow-hidden">
            {WORDS.map((w, i) => (
              <span key={w} className="absolute inset-x-0 top-0 whitespace-nowrap">
                {[...w].map((ch, j) => (
                  <span
                    key={j}
                    className="animate-letter-roll"
                    style={{
                      animationDelay: `${i * 2.5 + j * 0.035}s`,
                      // Lime → sky across the word, without repainting a background every frame
                      color: `color-mix(in oklch, var(--sky) ${Math.round((j / (w.length - 1)) * 100)}%, var(--spark))`,
                    }}
                  >
                    {ch === " " ? "\u00a0" : ch}
                  </span>
                ))}
              </span>
            ))}
          </span>
        </h2>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-side-muted sm:text-2xl lg:mt-8 lg:text-[1.75rem] lg:leading-snug">
          Jobs from hundreds of company career boards in India, matched to your resume and scored by AI, with an alert when a strong one lands.
        </p>
      </div>

      <div aria-hidden="true" className="relative -mx-6 overflow-hidden sm:-mx-12 lg:-mx-16 [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
        {(["animate-marquee", "animate-marquee-reverse"] as const).map((anim, row) => (
          <div key={anim} className={`flex w-max gap-3 ${anim} ${row ? "mt-3" : ""}`}>
            {[...ROLES, ...ROLES].map((r, i) => (
              <span key={i} className="whitespace-nowrap rounded-full border border-side-ink/15 bg-side-ink/5 px-4 py-2 text-sm text-side-muted sm:text-base">{r}</span>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function Notice({ tone, title, body }: { tone: "error" | "ok"; title: string; body?: string }) {
  const styles = tone === "error" ? "border-rejected/20 bg-rejected-soft text-rejected" : "border-accent/20 bg-accent-soft text-accent";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`mt-6 flex gap-3 rounded-xl border p-4 ${styles}`}>
      <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0" fill="currentColor">
        {tone === "error" ? (
          <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-.9 4h1.8v5H9.1V6Zm0 6.5h1.8v1.8H9.1v-1.8Z" />
        ) : (
          <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-1.3 11.3L5.4 10l1.2-1.2 2.1 2.1 4.7-4.7 1.2 1.2-5.9 5.9Z" />
        )}
      </svg>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {body && <p className="mt-1 text-sm leading-relaxed text-ink/80">{body}</p>}
      </div>
    </div>
  );
}

async function SignInContent({ searchParams }: { searchParams: Promise<SP> }) {
  if (await getCurrentUser()) redirect("/");
  const sp = await searchParams;
  const code = first(sp, "error");
  const error = code ? (ERRORS[code] ?? FALLBACK) : null;
  const deleted = first(sp, "deleted") === "1";

  return (
    <>
      <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-sm font-bold uppercase tracking-widest text-accent">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
          <path d="M10 1.5a4.5 4.5 0 0 0-4.5 4.5v2H5a2 2 0 0 0-2 2v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-.5V6A4.5 4.5 0 0 0 10 1.5ZM7.5 8V6a2.5 2.5 0 0 1 5 0v2h-5Z" />
        </svg>
        Private beta
      </p>
      <h1 className="mt-6 bg-gradient-to-r from-ink to-accent bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">Invite-only access</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">Sign in with the Google account you were invited with to see your matches and track applications.</p>
      {deleted && <Notice tone="ok" title="Your account and data were deleted." />}
      {error && <Notice tone="error" title={error.title} body={error.body} />}
      <div className="mt-8">
        {code === "NOT_INVITED" ? <GoogleSignIn label="Use another Google account" /> : <GoogleSignIn />}
      </div>
      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        No invite? Ask the owner for one. By continuing you agree to your resume being processed to match and score jobs.
      </p>
      {code && error === FALLBACK && <p className="mt-3 text-center text-[11px] text-faint">Error code: {code}</p>}
    </>
  );
}

export default function SignInPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Shell>
      <Suspense fallback={<div className="h-11 animate-pulse rounded-xl bg-subtle" />}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
