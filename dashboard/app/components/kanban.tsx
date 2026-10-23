"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import type { BoardRow, Status } from "@/lib/jobs";
import { prettyCompany, timeAgo } from "@/lib/format";
import { updateStatus } from "../actions";
import { celebrate } from "./celebrate";
import { Score } from "./ui";
import { CompanyLogo } from "./company-logo";

const COLUMNS: { status: Status; title: string; dot: string; drop: string }[] = [
  { status: "saved", title: "Saved", dot: "bg-saved", drop: "bg-saved-soft" },
  { status: "applied", title: "Applied", dot: "bg-applied", drop: "bg-applied-soft" },
  { status: "interviewing", title: "Interviewing", dot: "bg-interview", drop: "bg-interview-soft" },
  { status: "offer", title: "Offer", dot: "bg-offer", drop: "bg-offer-soft" },
  { status: "rejected", title: "Rejected", dot: "bg-rejected", drop: "bg-rejected-soft" },
];

// Drag a card to another column to change its status. Clicking a card opens it (with notes).
export function Kanban({ jobs, hrefs }: { jobs: BoardRow[]; hrefs: Record<string, string> }) {
  const [, startTransition] = useTransition();
  const [board, moveOptimistic] = useOptimistic(jobs, (list, m: { id: string; to: Status }) =>
    list.map((j) => (j.id === m.id ? { ...j, status: m.to, status_changed_at: new Date().toISOString() } : j)),
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);

  function drop(to: Status) {
    const job = board.find((j) => j.id === dragging);
    setDragging(null);
    setOver(null);
    if (!job || job.status === to) return;
    if (to === "applied" || to === "interviewing" || to === "offer") celebrate();
    startTransition(async () => {
      moveOptimistic({ id: job.id, to });
      await updateStatus(job.id, to);
    });
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
      <div className="grid min-w-[64rem] grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const items = board.filter((j) => j.status === col.status);
          return (
            <section
              key={col.status}
              aria-label={col.title}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.status);
              }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(null)}
              onDrop={() => drop(col.status)}
              className={`flex min-h-[28rem] flex-col rounded-2xl p-2 transition-colors ${over === col.status ? col.drop : "bg-surface/60 border border-rule"}`}
            >
              <h2 className="flex items-center gap-2 px-2 pb-2 pt-1 text-sm font-semibold">
                <span aria-hidden="true" className={`size-2 rounded-full ${col.dot}`} />
                {col.title}
                <span className="ml-auto text-xs tabular-nums text-faint">{items.length}</span>
              </h2>

              <ul className="flex flex-1 flex-col gap-2">
                {items.map((job) => (
                  <li
                    key={job.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(job.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={`group relative cursor-grab rounded-xl border border-rule bg-surface p-3 shadow-card transition-[opacity,box-shadow] hover:shadow-lift active:cursor-grabbing ${
                      dragging === job.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={hrefs[job.id]!}
                        scroll={false}
                        draggable={false}
                        className="line-clamp-2 text-sm font-medium leading-snug after:absolute after:inset-0 focus-visible:outline-none"
                      >
                        {job.title}
                      </Link>
                      <Score score={job.fit_score} />
                    </div>
                    <p className="mt-2 flex items-center gap-2 truncate text-xs text-muted">
                      <CompanyLogo company={job.company} url={job.url} size="sm" />
                      <span className="truncate">{prettyCompany(job.company)}</span>
                    </p>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-faint">
                      <span>{timeAgo(job.status_changed_at)}</span>
                      {job.notes && (
                        <span title={job.notes} className="flex items-center gap-1">
                          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 4h10v12H5zM8 8h4M8 11h4" /></svg>
                          Notes
                        </span>
                      )}
                    </div>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-rule px-3 py-8 text-center text-xs text-faint">
                    Drop here
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
