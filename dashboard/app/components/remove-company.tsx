"use client";

import { useTransition } from "react";
import { removeCompany } from "../actions";

export function RemoveCompany({ source, slug, name }: { source: string; slug: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => removeCompany(source, slug))}
      aria-label={`Remove ${name}`}
      className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-rejected-soft hover:text-rejected focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
