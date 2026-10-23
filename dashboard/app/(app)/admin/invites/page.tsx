import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { sql } from "@/lib/db";
import { requireOwner } from "@/lib/session";
import { timeAgo } from "@/lib/format";
import { InviteForm, RemoveInviteButton } from "@/app/components/invites";
import { Empty, PageHeader } from "@/app/components/ui";

export const metadata: Metadata = { title: "Invites · job-radar" };

type Row = { email: string; invited_at: string | null; name: string | null; signed_up: string | null; onboarded: string | null; owner: boolean };

async function InvitesContent() {
  await connection();
  const owner = await requireOwner();
  // Everyone invited, plus anyone with an account (the owner has no invite row)
  const rows = (await sql`
    SELECT coalesce(i.email, lower(u.email)) AS email, i.invited_at, u.name,
           u."createdAt" AS signed_up, p.onboarded_at AS onboarded,
           lower(u.email) = ${owner.email.toLowerCase()} AS owner
    FROM invites i
    FULL JOIN "user" u ON lower(u.email) = i.email
    LEFT JOIN profiles p ON p.user_id = u.id
    ORDER BY owner DESC NULLS LAST, coalesce(i.invited_at, u."createdAt") DESC`) as Row[];

  const pill = "rounded-full px-2 py-0.5 text-[11px] font-semibold";
  return (
    <>
      <InviteForm />
      <section aria-labelledby="people-heading" className="mt-6 rounded-3xl border border-rule bg-surface shadow-card">
        <h2 id="people-heading" className="px-5 pt-5 text-sm font-bold">People</h2>
        {rows.length === 0 ? (
          <div className="p-5"><Empty>No invites yet.</Empty></div>
        ) : (
          <ul className="mt-3 divide-y divide-rule">
            {rows.map((r) => (
              <li key={r.email} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name ?? r.email}</p>
                  {r.name && <p className="truncate text-xs text-muted">{r.email}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.owner && <span className={`${pill} bg-lavender text-accent`}>Owner</span>}
                  {r.onboarded ? (
                    <span className={`${pill} bg-offer-soft text-offer`}>Onboarded</span>
                  ) : r.signed_up ? (
                    <span className={`${pill} bg-saved-soft text-saved`}>Signed up {timeAgo(r.signed_up)}</span>
                  ) : (
                    <span className={`${pill} bg-subtle text-muted`}>Invited {r.invited_at ? timeAgo(r.invited_at) : ""}</span>
                  )}
                  {!r.owner && r.invited_at && <RemoveInviteButton email={r.email} />}
                  {!r.owner && !r.invited_at && <span className={`${pill} bg-rejected-soft text-rejected`}>Not invited (locked out)</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function InvitesPage() {
  return (
    <>
      <PageHeader title="Invites" subtitle="Only invited Google accounts can sign in. You (the owner) always can." />
      <div className="mt-8 max-w-3xl">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-subtle" />}>
          <InvitesContent />
        </Suspense>
      </div>
    </>
  );
}
