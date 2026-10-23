"use client";

import type { Status } from "@/lib/jobs";
import { celebrate } from "./celebrate";

type Icon = "apply" | "save" | "unsave" | "hide";

const ICONS: Record<Icon, React.ReactNode> = {
  apply: <path d="M6 10h8m-3-3 3 3-3 3" />,
  save: <path d="M6 4h8v12l-4-3-4 3z" />,
  unsave: <path d="M6 4h8v12l-4-3-4 3zM4 4l12 12" />,
  hide: <path d="m6 6 8 8m0-8-8 8" />,
};

export function TriageButton({
  icon,
  label,
  primary = false,
  onClick,
}: {
  icon: Icon;
  label: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        if (icon === "apply") celebrate(e.currentTarget);
        onClick();
      }}
      title={label}
      className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
        primary ? "btn-gradient" : "text-muted hover:bg-subtle hover:text-ink"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-4">
        {ICONS[icon]}
      </svg>
      {label}
    </button>
  );
}

// What each one-click action does from the jobs list
export const TRIAGE = {
  hide: { to: "hidden" as Status, done: "Hidden. It won't show up again" },
  save: { to: "saved" as Status, done: "Saved ⭐ Come back to it soon" },
  unsave: { to: "new" as Status, done: "Moved back to review" },
};
export type TriageKind = keyof typeof TRIAGE;
