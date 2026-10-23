import { Suspense } from "react";
import { connection } from "next/server";
import { getBoard, getJob } from "@/lib/jobs";
import { first, hrefWith, type SP } from "@/lib/url";
import { JobPanel } from "../components/job-panel";
import { Kanban } from "../components/kanban";
import { PageHeader } from "../components/ui";

async function Board({ searchParams }: { searchParams: Promise<SP> }) {
  await connection();
  const sp = await searchParams;
  const jobId = first(sp, "job");
  const [jobs, detail] = await Promise.all([getBoard(), jobId ? getJob(jobId) : Promise.resolve(null)]);
  const openHref = (id: string) => hrefWith("/applied", sp, { job: id });

  return (
    <>
      <div className="mt-8">
        <Kanban jobs={jobs} hrefs={Object.fromEntries(jobs.map((j) => [j.id, openHref(j.id)]))} />
      </div>
      {detail && <JobPanel job={detail} nav={{ closeHref: hrefWith("/applied", sp, { job: null }), prevHref: null, nextHref: null }} />}
    </>
  );
}

export default function AppliedPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <>
      <PageHeader title="Applications" subtitle="Drag cards between columns as things move. Click one to add notes." />
      <Suspense fallback={<div className="mt-8 h-[28rem] animate-pulse rounded-2xl bg-subtle" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </>
  );
}
