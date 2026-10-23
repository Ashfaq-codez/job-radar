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
      className="btn-gradient inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.56 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51z" />
      </svg>
      {pending ? "Opening Google…" : label}
    </button>
  );
}
