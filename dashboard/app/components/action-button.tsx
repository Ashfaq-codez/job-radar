"use client";

import { useFormStatus } from "react-dom";

export function ActionButton({
  children,
  primary = false,
}: {
  children: React.ReactNode;
  primary?: boolean;
}) {
  const { pending } = useFormStatus();

  const base =
    "w-full whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors " +
    "disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const look = primary
    ? "bg-accent text-canvas hover:opacity-90"
    : "border border-rule text-ink hover:bg-surface";

  return (
    <button type="submit" disabled={pending} className={`${base} ${look}`}>
      {pending ? "Saving…" : children}
    </button>
  );
}