"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type Option = { label: string; href: string; active: boolean };

// A pill that shows the current value and opens a small menu of choices
export function FilterMenu({ label, options, isDefault, align = "left" }: { label: string; options: Option[]; isDefault: boolean; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.active) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          isDefault
            ? "border-rule bg-surface text-ink hover:bg-subtle"
            : "border-accent/25 bg-accent-soft text-accent"
        }`}
      >
        <span className={isDefault ? "text-muted" : "text-accent/80"}>{label}</span>
        <span className="font-medium">{current.label}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full z-20 mt-1.5 min-w-44 rounded-2xl border border-rule bg-surface p-1 shadow-lift animate-fade-in`}
        >
          {options.map((o) => (
            <Link
              key={o.href}
              href={o.href}
              role="menuitemradio"
              aria-checked={o.active}
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between gap-4 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none ${
                o.active ? "font-medium text-ink" : "text-muted"
              }`}
            >
              {o.label}
              {o.active && (
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 text-accent">
                  <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
