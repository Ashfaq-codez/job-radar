"use client";

import { useEffect, useRef } from "react";

// A <details> menu that also closes on an outside tap, on Escape, and after picking an item
export function Dropdown({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const close = () => el.removeAttribute("open");
    const onPointer = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        close();
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details
      ref={ref}
      className={className}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) ref.current?.removeAttribute("open");
      }}
    >
      {children}
    </details>
  );
}
