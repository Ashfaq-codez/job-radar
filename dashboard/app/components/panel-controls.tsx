"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { JobDetail, Status } from "@/lib/jobs";
import { STATUS_LABEL } from "@/lib/format";
import { saveNotes, updateStatus } from "../actions";
import { TriageButton } from "./triage";
import { celebrate } from "./celebrate";

type Nav = { closeHref: string; prevHref: string | null; nextHref: string | null };

// Moving a job along its pipeline; "new"/"saved" get the quick triage set
const NEXT_STEPS: Partial<Record<Status, Status[]>> = {
  applied: ["interviewing", "rejected"],
  interviewing: ["offer", "rejected"],
  offer: ["rejected"],
  rejected: ["applied"],
  hidden: ["new"],
};

export function PanelControls({ job, nav }: { job: Pick<JobDetail, "id" | "url" | "status">; nav: Nav }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const triage = job.status === "new" || job.status === "saved";

  // After acting on a role in review, jump straight to the next one
  function move(to: Status, { advance = triage, openPosting = false } = {}) {
    if (to === "interviewing" || to === "offer") celebrate();
    if (openPosting) window.open(job.url, "_blank", "noopener,noreferrer");
    startTransition(async () => {
      await updateStatus(job.id, to);
      if (advance) router.replace(nav.nextHref ?? nav.prevHref ?? nav.closeHref, { scroll: false });
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") return router.replace(nav.closeHref, { scroll: false });
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if ((e.key === "j" || e.key === "ArrowDown") && nav.nextHref) router.replace(nav.nextHref, { scroll: false });
      else if ((e.key === "k" || e.key === "ArrowUp") && nav.prevHref) router.replace(nav.prevHref, { scroll: false });
      else if (triage && e.key === "a") move("applied", { openPosting: true });
      else if (triage && e.key === "s") move(job.status === "saved" ? "new" : "saved");
      else if (e.key === "o") window.open(job.url, "_blank", "noopener,noreferrer");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={`flex flex-wrap items-center gap-1.5 transition-opacity ${pending ? "pointer-events-none opacity-50" : ""}`}>
      {triage ? (
        <>
          <TriageButton icon="apply" label="Apply" primary onClick={() => move("applied", { openPosting: true })} />
          {job.status === "saved" ? (
            <TriageButton icon="unsave" label="Unsave" onClick={() => move("new")} />
          ) : (
            <TriageButton icon="save" label="Save" onClick={() => move("saved")} />
          )}
        </>
      ) : (
        (NEXT_STEPS[job.status] ?? []).map((to, i) => (
          <button
            key={to}
            type="button"
            onClick={() => move(to, { advance: false })}
            className={`h-8 rounded-xl px-3 text-[13px] font-medium transition-colors ${
              i === 0 ? "btn-gradient" : "border border-rule text-muted hover:bg-subtle hover:text-ink"
            }`}
          >
            {to === "new" ? "Back to review" : `Move to ${STATUS_LABEL[to]}`}
          </button>
        ))
      )}
      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-[13px] font-medium text-accent hover:bg-accent-soft"
      >
        View posting ↗
      </a>
    </div>
  );
}

export function PanelNav({ nav }: { nav: Nav }) {
  const router = useRouter();
  const btn = "grid size-8 place-items-center rounded-xl text-muted transition-colors hover:bg-subtle hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={btn} disabled={!nav.prevHref} onClick={() => nav.prevHref && router.replace(nav.prevHref, { scroll: false })} title="Previous (K)" aria-label="Previous job">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 12 4-4 4 4" /></svg>
      </button>
      <button type="button" className={btn} disabled={!nav.nextHref} onClick={() => nav.nextHref && router.replace(nav.nextHref, { scroll: false })} title="Next (J)" aria-label="Next job">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 8 4 4 4-4" /></svg>
      </button>
      <button type="button" className={btn} onClick={() => router.replace(nav.closeHref, { scroll: false })} title="Close (Esc)" aria-label="Close">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 8 8m0-8-8 8" /></svg>
      </button>
    </div>
  );
}

export function NotesEditor({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  // Saves on its own a moment after you stop typing
  useEffect(() => {
    if (value === initial) return;
    const t = setTimeout(async () => {
      await saveNotes(id, value);
      setState("saved");
    }, 700);
    return () => clearTimeout(t);
  }, [value, id, initial]);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={`notes-${id}`} className="text-xs font-medium uppercase tracking-wide text-faint">Notes</label>
        <span className="text-xs text-faint" aria-live="polite">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}</span>
      </div>
      <textarea
        id={`notes-${id}`}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("saving");
        }}
        rows={4}
        placeholder="Recruiter name, interview dates, follow-ups…"
        className="mt-2 w-full resize-y rounded-xl border border-rule bg-canvas px-3 py-2 text-sm leading-relaxed placeholder:text-faint focus:border-accent/40 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent-soft"
      />
    </div>
  );
}


// While the panel is open, only the panel scrolls: freeze the page behind it
export function LockPageScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);
  return null;
}
