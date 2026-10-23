import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getProfileView } from "@/lib/profile";
import { requireOnboardedUser } from "@/lib/session";
import { DeleteAccount, TestAlertButton } from "@/app/components/profile/account-tools";
import { ProfileForm } from "@/app/components/profile/profile-form";
import { ResumeUpload } from "@/app/components/profile/resume-upload";
import { SignOutButton } from "@/app/components/sign-out-button";
import { PageHeader } from "@/app/components/ui";

export const metadata: Metadata = { title: "Settings · job-radar" };

function Card({ title, children, tone = "" }: { title: string; children: React.ReactNode; tone?: string }) {
  return (
    <section aria-label={title} className={`rounded-3xl border border-rule bg-surface p-5 shadow-card sm:p-8 ${tone}`}>
      <h2 className="text-base font-bold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

async function SettingsContent() {
  await connection();
  const user = await requireOnboardedUser();
  const profile = (await getProfileView(user.id))!;

  return (
    <div className="mt-8 max-w-3xl space-y-6">
      <Card title="Preferences">
        <ProfileForm profile={profile} mode="settings" />
      </Card>
      <Card title="Resume">
        <ResumeUpload needsConsent={!profile.consented} updatedAt={profile.resumeUpdatedAt} />
      </Card>
      <Card title="Discord alerts">
        <p className="mb-4 text-sm text-muted">
          {profile.webhookLast4
            ? `Connected (…${profile.webhookLast4}). Alerts start at a score of ${profile.minNotifyScore}.`
            : user.isOwner
              ? "No webhook saved here; your alerts use DISCORD_WEBHOOK_URL from the pipeline."
              : "Not connected. Add a webhook URL under Preferences → More preferences."}
        </p>
        <TestAlertButton />
      </Card>
      <Card title="Account">
        <p className="text-sm text-muted">Signed in as <span className="font-medium text-ink">{user.email}</span>.</p>
        <SignOutButton className="mt-3 h-10 rounded-xl border border-rule px-4 text-sm font-medium text-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-accent" />
      </Card>
      <Card title="Delete account" tone="border-rejected/30">
        <DeleteAccount />
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Your resume, what you’re looking for, and alerts." />
      <Suspense fallback={<div className="mt-8 h-96 max-w-3xl animate-pulse rounded-3xl bg-subtle" />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}
