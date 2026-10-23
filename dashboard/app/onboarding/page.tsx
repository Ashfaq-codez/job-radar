import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getProfileView } from "@/lib/profile";
import { requireUser } from "@/lib/session";
import { ProfileForm } from "@/app/components/profile/profile-form";
import { ResumeUpload } from "@/app/components/profile/resume-upload";
import { SignOutButton } from "@/app/components/sign-out-button";

export const metadata: Metadata = { title: "Get started · job-radar" };

const EMPTY = {
  hasResume: false, resumeUpdatedAt: null, roleFamilies: [], extraTitles: [], experienceLevel: null, jobType: "both" as const,
  locations: [], openToRelocate: false, workModes: [], skills: [], avoidKeywords: [], avoidCompanies: [], companyTypes: [],
  gradYear: null, noticePeriod: null, minSalaryLpa: null, webhookLast4: null, minNotifyScore: 70, consented: false, onboarded: false,
};

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children?: React.ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="rounded-3xl border border-rule bg-surface p-5 shadow-card sm:p-8">
      <h2 id={`step-${n}`} className="flex items-center gap-3 text-lg font-bold">
        <span aria-hidden="true" className={`grid size-8 place-items-center rounded-full text-sm ${done ? "bg-offer-soft text-offer" : "bg-accent-soft text-accent"}`}>
          {done ? "✓" : n}
        </span>
        {title}
        {done && <span className="sr-only">(done)</span>}
      </h2>
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

async function Onboarding() {
  await connection();
  const user = await requireUser();
  const profile = (await getProfileView(user.id)) ?? EMPTY;
  if (profile.onboarded) redirect("/");
  const hasResume = profile.hasResume && profile.consented;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">Hi {user.name.split(" ")[0]} 👋</p>
          <h1 className="text-gradient mt-1 text-3xl font-extrabold tracking-tight">Let’s set up your radar</h1>
          <p className="mt-1 text-sm text-muted">Two quick steps. You can change everything later in Settings.</p>
        </div>
        <SignOutButton className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline" />
      </header>
      <div className="mt-8 space-y-6">
        <Step n={1} title="Upload your resume" done={hasResume}>
          <ResumeUpload needsConsent={!profile.consented} updatedAt={profile.resumeUpdatedAt} />
        </Step>
        {hasResume ? (
          <Step n={2} title="What are you looking for?">
            <ProfileForm profile={profile} mode="onboarding" />
          </Step>
        ) : (
          <Step n={2} title="What are you looking for?" />
        )}
      </div>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-subtle" />}>
        <Onboarding />
      </Suspense>
    </main>
  );
}
