import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getCompanies } from "@/lib/jobs";
import { requireOnboardedUser } from "@/lib/session";
import { boardInfo, logoUrl } from "@/lib/logos";
import { boardUrl, prettyCompany, timeAgo } from "@/lib/format";
import { Empty, PageHeader, Score } from "@/app/components/ui";
import { CompanyLogo } from "@/app/components/company-logo";
import { AddCompany } from "@/app/components/add-company";
import { RemoveCompany } from "@/app/components/remove-company";

async function CompanyTable() {
  await connection();
  const user = await requireOnboardedUser();
  const companies = await getCompanies(user.id, user.isOwner);

  if (companies.length === 0) {
    return (
      <div className="mt-8">
        <Empty title="No companies yet">Run npm run discover in the pipeline folder.</Empty>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-rule bg-surface shadow-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-rule text-xs text-faint">
          <tr>
            <th scope="col" className="px-3 py-2.5 sm:px-4 font-medium">Company</th>
            <th scope="col" className="px-3 py-2.5 sm:px-4 font-medium"><span className="sm:hidden">Roles</span><span className="hidden sm:inline">Open dev roles</span></th>
            <th scope="col" className="hidden px-3 sm:px-4 py-2.5 font-medium sm:table-cell">Best match</th>
            <th scope="col" className="hidden px-3 sm:px-4 py-2.5 font-medium md:table-cell">All India jobs</th>
            <th scope="col" className="hidden px-3 sm:px-4 py-2.5 font-medium lg:table-cell">Board</th>
            <th scope="col" className="hidden px-3 sm:px-4 py-2.5 font-medium lg:table-cell">Checked</th>
            <th scope="col" className="hidden px-3 py-2.5 sm:table-cell sm:px-4"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {companies.map((c) => {
            const name = c.name ?? prettyCompany(c.slug);
            const board = boardInfo(c.source, c.slug);
            return (
              <tr key={`${c.source}:${c.slug}`} className="transition-colors hover:bg-subtle/60">
                <td className="px-3 py-2.5 sm:px-4 font-medium">
                  <span className="flex items-center gap-3">
                    <CompanyLogo company={c.source === "careers" ? name : c.slug} url={c.source === "careers" ? c.slug : undefined} size="sm" />
                    {/* Badge sits under the name so long names keep their width on phones */}
                    <span className="flex min-w-0 flex-col items-start gap-1">
                      <span className="break-words">{name}</span>
                      {c.removable && (
                        <span className="flex items-center gap-1">
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">{c.added_by_you ? "Added by you" : "Added by a user"}</span>
                          {/* Phones: Remove lives here instead of its own column */}
                          <span className="sm:hidden"><RemoveCompany source={c.source} slug={c.slug} name={name} /></span>
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3 sm:px-4 tabular-nums">
                  {c.dev_roles > 0 ? (
                    <Link
                      href={`/jobs?q=${encodeURIComponent(c.source === "careers" ? name : c.slug)}`}
                      className="inline-flex min-w-7 justify-center rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent hover:bg-accent/15"
                    >
                      {c.dev_roles}
                    </Link>
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                </td>
                <td className="hidden px-3 sm:px-4 py-3 sm:table-cell">
                  {c.best_score === null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <Score score={c.best_score} />
                  )}
                </td>
                <td className="hidden px-3 sm:px-4 py-3 tabular-nums text-muted md:table-cell">{c.india_jobs}</td>
                <td className="hidden px-3 sm:px-4 py-3 lg:table-cell">
                  <a
                    href={boardUrl(c.source, c.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-rule bg-surface py-1 pl-1 pr-2.5 text-xs font-medium text-muted transition-colors hover:border-accent/30 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {board.domain ? (
                      // eslint-disable-next-line @next/next/no-img-element -- tiny external favicon
                      <img src={logoUrl(board.domain)} alt="" loading="lazy" className="size-4 rounded-full" />
                    ) : (
                      <span aria-hidden="true" className="size-4 rounded-full bg-subtle" />
                    )}
                    {board.label}
                    <span className="sr-only">(opens in new tab)</span>
                  </a>
                </td>
                <td className="hidden px-3 sm:px-4 py-3 text-muted lg:table-cell">{timeAgo(c.last_checked_at)}</td>
                <td className="hidden px-3 py-3 text-right sm:table-cell sm:px-4">
                  {c.removable && <RemoveCompany source={c.source} slug={c.slug} name={name} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CompaniesPage() {
  return (
    <>
      <PageHeader
        title="Companies"
        subtitle="Companies with openings in India, found automatically or added by you. Click a count to see their developer roles."
      />
      <AddCompany />
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-2xl border border-rule bg-surface" />}>
        <CompanyTable />
      </Suspense>
    </>
  );
}