import { Suspense } from "react";
import { connection } from "next/server";
import { requireOnboardedUser } from "@/lib/session";
import { getJob, getJobs, PAGE_SIZE } from "@/lib/jobs";
import { parseFilters } from "@/lib/filters";
import { first, hrefWith, type SP } from "@/lib/url";
import { JobFiltersBar, JobTabs } from "@/app/components/job-filters";
import { JobGrid } from "@/app/components/job-grid";
import { JobPanel } from "@/app/components/job-panel";
import { Pagination } from "@/app/components/pagination";
import { Empty, Loading, PageHeader } from "@/app/components/ui";

async function JobsContent({ searchParams }: { searchParams: Promise<SP> }) {
  await connection();
  const user = await requireOnboardedUser();
  const sp = await searchParams;
  const f = parseFilters(sp);
  const jobId = first(sp, "job");

  const [{ rows, total, counts }, detail] = await Promise.all([
    getJobs(user.id, f),
    jobId ? getJob(user.id, jobId) : Promise.resolve(null),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (f.page - 1) * PAGE_SIZE + 1;
  const end = Math.min(f.page * PAGE_SIZE, total);
  const pageLink = (page: number) => hrefWith("/jobs", sp, { page: String(page), job: null });
  const openHref = (id: string) => hrefWith("/jobs", sp, { job: id });
  const hrefs = Object.fromEntries(rows.map((j) => [j.id, openHref(j.id)]));

  // Neighbours of the open job, so the panel can step through the list
  const at = rows.findIndex((j) => j.id === jobId);
  const nav = {
    closeHref: hrefWith("/jobs", sp, { job: null }),
    prevHref: at > 0 ? openHref(rows[at - 1]!.id) : null,
    nextHref: at >= 0 && at < rows.length - 1 ? openHref(rows[at + 1]!.id) : null,
  };

  return (
    <>
      <div className="mt-6 space-y-4">
        <JobTabs sp={sp} f={f} counts={counts} />
        <JobFiltersBar sp={sp} f={f} />
      </div>

      <p className="mb-3 mt-5 text-xs text-faint">
        {total === 0 ? "No roles" : `${start}–${end} of ${total} roles`}
        {f.q && <> matching “{f.q}”</>}
      </p>

      {rows.length > 0 ? (
        <JobGrid key={`${f.view}:${f.page}`} rows={rows} hrefs={hrefs} view={f.view} panelOpen={!!detail} />
      ) : f.view === "saved" && counts.saved === 0 ? (
        <Empty title="Nothing saved yet">Press Save on a role (or hit S) to shortlist it here.</Empty>
      ) : (
        <Empty title="No roles match">Try removing a filter or searching for something else.</Empty>
      )}

      <Pagination page={f.page} pages={pages} href={pageLink} />

      {detail && <JobPanel job={detail} nav={nav} />}
    </>
  );
}

export default function JobsPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <>
      <PageHeader title="Jobs" subtitle="Open entry-level developer roles, ranked by how well they fit your resume." />
      <Suspense fallback={<Loading />}>
        <JobsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
