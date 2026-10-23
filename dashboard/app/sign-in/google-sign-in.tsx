"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function GoogleSignIn({ label = "Continue with Google" }: { label?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        // Redirects to Google; errors come back to /sign-in?error=...
        const res = await authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/sign-in" });
        if (res.error) setPending(false);
      }}
      className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl btn-gradient pl-2 pr-5 text-base font-semibold shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
    >
      {!pending && (
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-surface">
          <svg viewBox="0 0 48 48" className="size-4">
            <path fill="var(--g-red)" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z" />
            <path fill="var(--g-blue)" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
            <path fill="var(--g-yellow)" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.2z" />
            <path fill="var(--g-green)" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
          </svg>
        </span>
      )}
      {pending && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
      {pending ? "Redirecting to Google…" : label}
    </button>
  );
}
