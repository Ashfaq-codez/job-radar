"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import type { JobRow, Status } from "@/lib/jobs";
import { updateStatus } from "../actions";
import { JobCard } from "./job-card";
import { TRIAGE, TriageButton, type TriageKind } from "./triage";
import { celebrate } from "./celebrate";

type Toast = { id: string; prev: Status; message: string };

export function JobGrid({
  rows,
  hrefs,
  view,
  panelOpen,
}: {
  rows: JobRow[];
  hrefs: Record<string, string>;
  view: "review" | "saved";
  panelOpen: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Cards vanish the moment you act; the server refresh that follows confirms it
  const [visible, removeOptimistic] = useOptimistic(rows, (list, id: string) => list.filter((j) => j.id !== id));
  const [rawFocus, setFocus] = useState(-1);
  const [toast, setToast] = useState<Toast | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const focus = Math.min(rawFocus, visible.length - 1); // stays in range as cards disappear

  function act(job: JobRow, kind: TriageKind) {
    if (kind === "apply") window.open(job.url, "_blank", "noopener,noreferrer");
    setToast({ id: job.id, prev: job.status, message: TRIAGE[kind].done });
    startTransition(async () => {
      removeOptimistic(job.id);
      await updateStatus(job.id, TRIAGE[kind].to);
    });
  }

  function undo() {
    if (!toast) return;
    const { id, prev } = toast;
    setToast(null);
    startTransition(() => updateStatus(id, prev));
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Keyboard triage: j/k (or arrows) to move, Enter to open, a/s to act, z to undo
  useEffect(() => {
    if (panelOpen) return; // the open panel has its own shortcuts
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]")) return;
      const job = visible[focus];
      const move = (d: number) => {
        e.preventDefault();
        const next = Math.min(visible.length - 1, Math.max(0, focus + d));
        setFocus(next);
        cardRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      };
      if (e.key === "j" || e.key === "ArrowDown" || e.key === "ArrowRight") move(1);
      else if (e.key === "k" || e.key === "ArrowUp" || e.key === "ArrowLeft") move(-1);
      else if (e.key === "Enter" && job) router.push(hrefs[job.id]!, { scroll: false });
      else if (e.key === "a" && job) {
        celebrate();
        act(job, "apply");
      }
      else if (e.key === "s" && job) act(job, view === "saved" ? "unsave" : "save");
      else if (e.key === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((job, i) => (
          <li key={job.id} ref={(el) => { cardRefs.current[i] = el as HTMLDivElement | null; }} onMouseEnter={() => setFocus(i)}>
            <JobCard
              job={job}
              href={hrefs[job.id]!}
              focused={i === focus}
              actions={
                <>
                  <TriageButton icon="apply" label="Apply" primary onClick={() => act(job, "apply")} />
                  {view === "saved" ? (
                    <TriageButton icon="unsave" label="Unsave" onClick={() => act(job, "unsave")} />
                  ) : (
                    <TriageButton icon="save" label="Save" onClick={() => act(job, "save")} />
                  )}
                </>
              }
            />
          </li>
        ))}
      </ul>


      {toast && (
        <div role="status" className="animate-fade-in fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl bg-ink px-4 py-2.5 text-sm text-white shadow-lift">
          {toast.message}
          <button type="button" onClick={undo} className="font-medium text-white/70 underline-offset-2 hover:text-white hover:underline">
            Undo
          </button>
        </div>
      )}
    </>
  );
}
