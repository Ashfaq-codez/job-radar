"use client";

import { useActionState, useTransition } from "react";
import { addInvite, removeInvite, type InviteState } from "@/app/admin-actions";
import { Message, inputClass } from "./profile/fields";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(addInvite, null);
  return (
    <section aria-labelledby="invite-heading" className="rounded-3xl border border-rule bg-surface p-5 shadow-card">
      <h2 id="invite-heading" className="text-sm font-bold">Invite someone</h2>
      <p className="mt-0.5 text-xs text-muted">Use the exact Gmail / Google account they’ll sign in with.</p>
      <form action={action} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="invite-email" className="sr-only">Email</label>
        <input id="invite-email" name="email" type="email" required maxLength={254} placeholder="friend@gmail.com" className={`${inputClass} sm:flex-1`} />
        <button type="submit" disabled={pending} className="btn-gradient h-10 shrink-0 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">
          {pending ? "Inviting…" : "Invite"}
        </button>
      </form>
      <div className="mt-3"><Message state={state} /></div>
    </section>
  );
}

export function RemoveInviteButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Remove ${email}? They'll be signed out and can't sign in again until re-invited.`)) {
          startTransition(() => removeInvite(email));
        }
      }}
      className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-rejected-soft hover:text-rejected focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
