"use client";

import { useActionState } from "react";
import { addCompany, type AddCompanyState } from "../actions";

const TONE = {
  success: "bg-offer-soft text-offer",
  info: "bg-saved-soft text-saved",
  error: "bg-rejected-soft text-rejected",
};

// Paste a careers page; the server works out which job board it uses and starts tracking it
export function AddCompany() {
  const [state, action, pending] = useActionState<AddCompanyState, FormData>(addCompany, null);

  return (
    <section aria-labelledby="add-company-heading" className="mt-6 rounded-3xl border border-rule bg-surface p-5 shadow-card">
      <h2 id="add-company-heading" className="text-sm font-bold">Add a company</h2>
      <p className="mt-0.5 text-xs text-muted">
        Paste any careers page. Greenhouse, Lever, Ashby, Workday and pages with job data are supported.
      </p>
      <form action={action} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="company-url" className="sr-only">Careers page URL</label>
        <input
          id="company-url"
          name="url"
          type="url"
          required
          maxLength={500}
          placeholder="https://company.com/careers"
          className="h-10 w-full min-w-0 rounded-xl sm:flex-1 border border-rule bg-canvas px-3 text-sm placeholder:text-faint focus:border-accent/40 focus:outline-none focus:ring-4 focus:ring-accent-soft"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Checking…" : "Add company"}
        </button>
      </form>
      <div aria-live="polite">
        {state && !pending && <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${TONE[state.tone]}`}>{state.message}</p>}
      </div>
    </section>
  );
}
