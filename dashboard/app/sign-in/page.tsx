import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/session";
import { first, type SP } from "@/lib/url";
import { GoogleSignIn } from "./google-sign-in";

export const metadata: Metadata = { title: "Sign in · job-radar" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-rule bg-surface p-8 text-center shadow-lift">
        <p className="font-black uppercase leading-none tracking-tighter text-3xl">
          Job<span className="text-accent">Radar</span>
        </p>
        {children}
      </div>
    </main>
  );
}

async function SignInContent({ searchParams }: { searchParams: Promise<SP> }) {
  if (await getCurrentUser()) redirect("/");
  const sp = await searchParams;
  const error = first(sp, "error");
  const deleted = first(sp, "deleted") === "1";

  if (error === "NOT_INVITED") {
    return (
      <Shell>
        <h1 className="mt-6 text-lg font-bold">You need an invite</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          job-radar is invite-only. Ask the person who shared it with you to invite the exact Google account you signed in with, then try again.
        </p>
        <div className="mt-6"><GoogleSignIn label="Try another Google account" /></div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mt-6 text-lg font-bold">Your early-career job radar</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">Jobs in India matched to your resume, scored by AI, with alerts when a strong one lands.</p>
      {deleted && (
        <p role="status" className="mt-4 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
          Your account and data were deleted.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-rejected-soft px-3 py-2 text-sm text-rejected">
          Sign-in didn’t work. Please try again.
        </p>
      )}
      <div className="mt-6"><GoogleSignIn /></div>
      <p className="mt-4 text-xs text-faint">Invite-only. You’ll need an invite from the owner.</p>
    </Shell>
  );
}

export default function SignInPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<Shell><div className="mt-6 h-11 animate-pulse rounded-xl bg-subtle" /></Shell>}>
      <SignInContent searchParams={searchParams} />
    </Suspense>
  );
}
