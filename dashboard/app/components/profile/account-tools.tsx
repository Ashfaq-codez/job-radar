"use client";

import { useActionState } from "react";
import { deleteAccount, sendTestAlert, type FormState } from "@/app/profile-actions";
import { Message, inputClass } from "./fields";

export function TestAlertButton() {
  const [state, action, pending] = useActionState<FormState>(sendTestAlert, null);
  return (
    <form action={action} className="space-y-3">
      <button type="submit" disabled={pending} className="h-10 rounded-xl border border-rule px-4 text-sm font-medium text-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
        {pending ? "Sending…" : "Send test alert"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function DeleteAccount() {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccount, null);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted">
        Deletes your profile, resume text, scores, tracker and notes, and signs you out. Shared job listings and companies stay. This can’t be undone.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="confirm-delete" className="sr-only">Type DELETE to confirm</label>
        <input id="confirm-delete" name="confirm" autoComplete="off" placeholder="Type DELETE to confirm" className={`${inputClass} sm:max-w-xs`} />
        <button type="submit" disabled={pending} className="h-10 shrink-0 rounded-xl bg-rejected px-4 text-sm font-semibold text-canvas hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rejected disabled:opacity-60">
          {pending ? "Deleting…" : "Delete my account and data"}
        </button>
      </div>
      <Message state={state} />
    </form>
  );
}
