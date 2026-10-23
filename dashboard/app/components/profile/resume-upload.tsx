"use client";

import { useActionState, useState } from "react";
import { uploadResume, type FormState } from "@/app/profile-actions";
import { CONSENT_TEXT, MAX_RESUME_BYTES } from "@/lib/profile-options";
import { Message } from "./fields";

// Step 1 of onboarding, and "Replace resume" in settings
export function ResumeUpload({ needsConsent, updatedAt }: { needsConsent: boolean; updatedAt: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadResume, null);
  const [tooBig, setTooBig] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="resume" className="text-sm font-semibold">
          {updatedAt ? "Replace your resume" : "Your resume"}
        </label>
        <p className="mt-0.5 text-xs text-muted">
          PDF or Word (.docx), up to 5 MB. Only the text is kept; the file itself is thrown away.
          {updatedAt && ` Last updated ${new Date(updatedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}.`}
        </p>
        <input
          id="resume"
          name="resume"
          type="file"
          required
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          aria-invalid={state?.field === "resume" || tooBig || undefined}
          onChange={(e) => setTooBig((e.target.files?.[0]?.size ?? 0) > MAX_RESUME_BYTES)}
          className="mt-3 block w-full text-sm text-muted file:mr-3 file:h-10 file:rounded-xl file:border-0 file:bg-accent-soft file:px-4 file:text-sm file:font-semibold file:text-accent hover:file:bg-accent-soft/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {tooBig && <p className="mt-2 text-sm text-rejected">That file is over 5 MB.</p>}
      </div>

      {needsConsent && (
        <label className="flex gap-3 rounded-2xl bg-canvas p-4 text-sm leading-relaxed">
          <input type="checkbox" name="consent" required className="mt-1 size-4 shrink-0 accent-[var(--accent)]" aria-invalid={state?.field === "consent" || undefined} />
          <span>{CONSENT_TEXT}</span>
        </label>
      )}

      <Message state={state} />
      <button
        type="submit"
        disabled={pending || tooBig}
        className="btn-gradient h-10 rounded-xl px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Reading your resume…" : updatedAt ? "Upload new resume" : "Upload and continue"}
      </button>
    </form>
  );
}
