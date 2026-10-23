"use client";

import { useActionState } from "react";
import { saveProfileAction, type FormState } from "@/app/profile-actions";
import {
  COMPANY_TYPES, EXPERIENCE_LEVELS, JOB_TYPES, LOCATIONS, NOTICE_PERIODS, ROLE_FAMILIES, WORK_MODES,
  type ProfileView,
} from "@/lib/profile-options";
import { ChipInput, Fieldset, Message, Pill, PillGroup, inputClass } from "./fields";

// Step 2 of onboarding, and the main part of settings. One screen; extras are folded away.
export function ProfileForm({ profile, mode }: { profile: ProfileView; mode: "onboarding" | "settings" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfileAction, null);
  const bad = (field: string) => state?.tone === "error" && state.field === field;
  const level = profile.experienceLevel ?? "fresher";

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="mode" value={mode} />

      <Fieldset legend="Roles you want" hint="Pick all that fit." error={bad("role_families")}>
        <PillGroup>
          {ROLE_FAMILIES.map((f) => (
            <Pill key={f.value} name="role_families" value={f.value} label={f.label} defaultChecked={profile.roleFamilies.includes(f.value)} />
          ))}
        </PillGroup>
      </Fieldset>

      <Fieldset legend="Other job titles" hint="Specific titles to include too, e.g. “Salesforce Developer”.">
        <ChipInput name="extra_titles" label="Other job titles" initial={profile.extraTitles} />
      </Fieldset>

      <Fieldset legend="Experience" hint="Jobs asking for more years than this are hidden.">
        <PillGroup>
          {EXPERIENCE_LEVELS.map((l) => (
            <Pill key={l.value} type="radio" name="experience_level" value={l.value} label={l.label} defaultChecked={level === l.value} />
          ))}
        </PillGroup>
      </Fieldset>

      <Fieldset legend="Job type">
        <PillGroup>
          {JOB_TYPES.map((t) => (
            <Pill key={t.value} type="radio" name="job_type" value={t.value} label={t.label} defaultChecked={profile.jobType === t.value} />
          ))}
        </PillGroup>
      </Fieldset>

      <Fieldset legend="Locations" hint="Jobs that just say “India” are always included." error={bad("locations")}>
        <PillGroup>
          {LOCATIONS.map((l) => (
            <Pill key={l} name="locations" value={l} label={l} defaultChecked={profile.locations.includes(l)} />
          ))}
        </PillGroup>
        <label className="mt-3 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="open_to_relocate" defaultChecked={profile.openToRelocate} className="size-4 accent-[var(--accent)]" />
          Open to relocating anywhere in India
        </label>
      </Fieldset>

      <Fieldset legend="Skills" hint="Used for AI scoring. Pre-filled from your resume.">
        <ChipInput name="skills" label="Skills" initial={profile.skills} />
      </Fieldset>

      <details className="group rounded-2xl border border-rule p-4 open:bg-canvas/50">
        <summary className="cursor-pointer list-none text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
          More preferences
          <span className="ml-2 text-xs font-normal text-muted">avoid lists, work mode, salary, Discord alerts</span>
        </summary>
        <div className="mt-6 space-y-8">
          <Fieldset legend="Avoid keywords" hint="Hide jobs whose title or description mentions these.">
            <ChipInput name="avoid_keywords" label="Avoid keywords" initial={profile.avoidKeywords} placeholder="e.g. night shift, PHP" />
          </Fieldset>
          <Fieldset legend="Avoid companies">
            <ChipInput name="avoid_companies" label="Avoid companies" initial={profile.avoidCompanies} />
          </Fieldset>
          <Fieldset legend="Work mode" hint="Shared with the AI scorer; job posts rarely say this reliably.">
            <PillGroup>
              {WORK_MODES.map((m) => (
                <Pill key={m.value} name="work_modes" value={m.value} label={m.label} defaultChecked={profile.workModes.includes(m.value)} />
              ))}
            </PillGroup>
          </Fieldset>
          <Fieldset legend="Company types">
            <PillGroup>
              {COMPANY_TYPES.map((c) => (
                <Pill key={c.value} name="company_types" value={c.value} label={c.label} defaultChecked={profile.companyTypes.includes(c.value)} />
              ))}
            </PillGroup>
          </Fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="grad_year" className="text-sm font-semibold">Graduation year</label>
              <input id="grad_year" name="grad_year" type="number" min={1990} max={2040} defaultValue={profile.gradYear ?? ""} className={`mt-2 ${inputClass}`} />
            </div>
            <div>
              <label htmlFor="notice_period" className="text-sm font-semibold">Notice period</label>
              <select id="notice_period" name="notice_period" defaultValue={profile.noticePeriod ?? ""} className={`mt-2 ${inputClass}`}>
                <option value="">Not set</option>
                {NOTICE_PERIODS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="min_salary_lpa" className="text-sm font-semibold">Minimum salary (LPA)</label>
              <input id="min_salary_lpa" name="min_salary_lpa" type="number" min={0} max={500} step="0.5" placeholder="Optional" defaultValue={profile.minSalaryLpa ?? ""} className={`mt-2 ${inputClass}`} />
            </div>
          </div>
          <Fieldset legend="Discord alerts" hint="Optional. New strong matches are posted to your channel after each pipeline run." error={bad("webhook")}>
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <div>
                <label htmlFor="webhook" className="text-xs font-medium text-muted">
                  {profile.webhookLast4 ? `Connected (…${profile.webhookLast4}). Paste a new URL to replace it.` : "Webhook URL"}
                </label>
                <input id="webhook" name="webhook" type="url" autoComplete="off" placeholder="https://discord.com/api/webhooks/…" className={`mt-1 ${inputClass}`} />
                {profile.webhookLast4 && (
                  <label className="mt-2 inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" name="remove_webhook" className="size-4 accent-[var(--accent)]" /> Disconnect
                  </label>
                )}
              </div>
              <div>
                <label htmlFor="min_notify_score" className="text-xs font-medium text-muted">Alert from score</label>
                <input id="min_notify_score" name="min_notify_score" type="number" min={0} max={100} defaultValue={profile.minNotifyScore} className={`mt-1 ${inputClass}`} />
              </div>
            </div>
          </Fieldset>
        </div>
      </details>

      <div className="space-y-3">
        <Message state={state} />
        <button
          type="submit"
          disabled={pending}
          className="btn-gradient h-11 rounded-xl px-6 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "onboarding" ? "Finish and see my jobs" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
