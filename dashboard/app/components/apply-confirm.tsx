"use client";

import { useTransition } from "react";
import type { JobRow } from "@/lib/jobs";
import { prettyCompany } from "@/lib/format";
import { clearOpened, confirmApplied, markOpened } from "../actions";
import { celebrate } from "./celebrate";

// A real link, so the posting opens in a new tab even if the server call is slow.
// It only records "opened"; the job moves to Applied once you answer "Yes".
export function ApplyLink({ job, onOpened }: { job: Pick<JobRow, "id" | "url">; onOpened?: () => void }) {
  const [, startTransition] = useTransition();
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        onOpened?.();
        startTransition(() => markOpened(job.id));
      }}
      className="btn-gradient inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
    >
      Apply on company site
      <span aria-hidden="true">↗</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

// Opens the posting from code (keyboard shortcut), same as clicking ApplyLink
export function openAndMark(job: Pick<JobRow, "id" | "url">, startTransition: (fn: () => Promise<void>) => void) {
  window.open(job.url, "_blank", "noopener,noreferrer");
  startTransition(() => markOpened(job.id));
}

// "Did you apply?" with Yes / Not yet. onAnswer runs inside the transition, so callers can update optimistically.
// Render it inside an element that is already aria-live, so screen readers announce the question when it appears.
export function DidYouApply({
  job,
  onAnswer,
  showJob = true,
}: {
  job: Pick<JobRow, "id" | "title" | "company">;
  onAnswer?: (applied: boolean) => void;
  showJob?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function answer(applied: boolean, button?: HTMLElement) {
    if (applied) celebrate(button);
    startTransition(async () => {
      onAnswer?.(applied);
      await (applied ? confirmApplied(job.id) : clearOpened(job.id));
    });
  }

  const btn = "h-8 rounded-xl px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-50";
  return (
    <div role="group" aria-label="Confirm application" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="min-w-0 flex-1 basis-48 text-sm">
        {showJob ? (
          <>Did you apply to <span className="font-semibold">{job.title}</span> at {prettyCompany(job.company)}?</>
        ) : (
          "Did you apply?"
        )}
      </p>
      <div className="flex gap-1.5">
        <button type="button" disabled={pending} onClick={(e) => answer(true, e.currentTarget)} className={`btn-gradient ${btn}`}>
          Yes, I applied
        </button>
        <button type="button" disabled={pending} onClick={() => answer(false)} className={`border border-rule text-muted hover:bg-subtle hover:text-ink ${btn}`}>
          Not yet
        </button>
      </div>
    </div>
  );
}
