"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Search box in the top bar. "/" or ⌘K focuses it. On the Jobs page it filters live as you type;
// elsewhere Enter jumps to Jobs with the query.
export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ref = useRef<HTMLInputElement>(null);
  const onJobs = pathname === "/jobs";
  const [value, setValue] = useState(onJobs ? (params.get("q") ?? "") : "");

  // Follow the URL (e.g. "Clear all", or leaving the Jobs page), but never fight the user mid-typing
  const urlQuery = onJobs ? (params.get("q") ?? "") : "";
  useEffect(() => {
    if (document.activeElement !== ref.current) setValue(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Live filtering on the Jobs page, debounced so we don't navigate on every keystroke
  useEffect(() => {
    if (!onJobs || value.trim() === urlQuery) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      next.delete("page");
      next.delete("job");
      router.replace(`/jobs?${next}`, { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  }, [value, onJobs, urlQuery, params, router]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (!onJobs) router.push(value.trim() ? `/jobs?q=${encodeURIComponent(value.trim())}` : "/jobs");
        ref.current?.blur();
      }}
      className="relative"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint">
        <circle cx="9" cy="9" r="5.5" />
        <path d="m13.5 13.5 3 3" strokeLinecap="round" />
      </svg>
      <label htmlFor="global-search" className="sr-only">Search roles or companies</label>
      <input
        ref={ref}
        id="global-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && ref.current?.blur()}
        placeholder="Search roles, companies"
        className="h-10 w-56 rounded-xl border border-rule bg-surface pl-9 pr-3 text-sm shadow-card transition-[width,box-shadow] placeholder:text-faint focus:w-80 focus:border-accent/40 focus:outline-none focus:ring-4 focus:ring-accent-soft sm:w-72"
      />
    </form>
  );
}
