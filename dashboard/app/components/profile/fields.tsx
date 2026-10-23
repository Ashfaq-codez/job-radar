"use client";

import { useId, useState } from "react";

// Small form building blocks shared by onboarding and settings

export const inputClass =
  "h-10 w-full min-w-0 rounded-xl border border-rule bg-canvas px-3 text-sm placeholder:text-faint focus:border-accent/40 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent-soft";

export const TONE = { success: "bg-offer-soft text-offer", error: "bg-rejected-soft text-rejected" };

export function Message({ state }: { state: { tone: "success" | "error"; message: string } | null }) {
  // Always rendered, so screen readers announce changes
  return (
    <div aria-live="polite">
      {state && <p className={`rounded-xl px-3 py-2 text-sm ${TONE[state.tone]}`}>{state.message}</p>}
    </div>
  );
}

export function Fieldset({ legend, hint, children, error }: { legend: string; hint?: string; children: React.ReactNode; error?: boolean }) {
  return (
    <fieldset className={`rounded-2xl ${error ? "ring-2 ring-rejected/40 p-3 -m-3" : ""}`}>
      <legend className="text-sm font-semibold">{legend}</legend>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

// Checkbox or radio styled as a pill
export function Pill({ type = "checkbox", name, value, label, defaultChecked }: { type?: "checkbox" | "radio"; name: string; value: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="relative inline-flex cursor-pointer select-none items-center rounded-full border border-rule bg-canvas px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/30 has-checked:border-accent has-checked:bg-accent-soft has-checked:font-semibold has-checked:text-accent has-focus-visible:ring-4 has-focus-visible:ring-accent-soft">
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="sr-only" />
      {label}
    </label>
  );
}

export function PillGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

// Free-text chips: type and press Enter (or comma). Each chip posts as a repeated hidden input.
export function ChipInput({ name, label, initial, placeholder, max = 40 }: { name: string; label: string; initial: string[]; placeholder?: string; max?: number }) {
  const [chips, setChips] = useState(initial);
  const [draft, setDraft] = useState("");
  const id = useId();

  function add(raw: string) {
    const parts = raw.split(",").map((s) => s.trim().slice(0, 60)).filter(Boolean);
    if (parts.length === 0) return;
    setChips((c) => [...new Set([...c, ...parts])].slice(0, max));
    setDraft("");
  }

  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      {chips.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label={label}>
          {chips.map((c) => (
            <li key={c} className="inline-flex items-center gap-1 rounded-full bg-subtle py-1 pl-3 pr-1 text-sm">
              {c}
              <input type="hidden" name={name} value={c} />
              <button
                type="button"
                onClick={() => setChips((cs) => cs.filter((x) => x !== c))}
                aria-label={`Remove ${c}`}
                className="grid size-5 place-items-center rounded-full text-muted hover:bg-rule hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        value={draft}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault(); // add a chip, don't submit the form
            add(draft);
          } else if (e.key === "Backspace" && draft === "" && chips.length) {
            setChips((c) => c.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
        placeholder={placeholder ?? "Type and press Enter"}
        maxLength={60}
        className={inputClass}
      />
    </div>
  );
}
