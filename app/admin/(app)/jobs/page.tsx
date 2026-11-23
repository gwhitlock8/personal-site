import Link from "next/link";
import { lastScanReport, listJobs, needsFit } from "@/lib/admin/job-scan";
import type { JobMatch } from "@/lib/admin/jobs";
import { dismissJob, fitJobNow, markApplied, restoreJob, scanNow } from "../../job-actions";
import { ago, button, FitCard, formatDate, ghost } from "../ui";

export const maxDuration = 60; // "Scan now" reads every board

const VIEWS = [
  { id: "new", label: "New" },
  { id: "applied", label: "Applied" },
  { id: "dismissed", label: "Not interested" },
  { id: "closed", label: "Closed" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const SOURCE: Record<JobMatch["source"], string> = {
  ashby: "Watchlist",
  greenhouse: "Watchlist",
  lever: "Watchlist",
  hn: "Hacker News",
  notion: "Agency job board",
};

function inView(j: JobMatch, v: View) {
  if (v === "closed") return !!j.closedAt && j.status === "new";
  if (v === "new") return j.status === "new" && !j.closedAt;
  return j.status === v;
}

function ScoreBadge({ job }: { job: JobMatch }) {
  if (job.fitScore === undefined) {
    return <span className="rounded-full bg-line/60 px-2 py-0.5 text-[12px] text-slate">{job.fitSkipped ? "No Fit Check" : "Fit Check pending"}</span>;
  }
  const tone = job.fitScore >= 75 ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : job.fitScore >= 50 ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-rose-50 text-rose-900 ring-rose-200";
  return <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1 ${tone}`}>Fit {job.fitScore}%</span>;
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ view?: string; error?: string; scanned?: string }> }) {
  const sp = await searchParams;
  const view: View = (VIEWS.find((v) => v.id === sp.view)?.id ?? "new") as View;
  const [jobs, report] = await Promise.all([listJobs(), lastScanReport()]);
  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, jobs.filter((j) => inView(j, v.id)).length])) as Record<View, number>;
  const shown = jobs
    .filter((j) => inView(j, view))
    .sort((a, b) => (view === "new" ? (b.fitScore ?? -1) - (a.fitScore ?? -1) : 0) || b.firstSeen.localeCompare(a.firstSeen));
  const waiting = jobs.filter(needsFit).length;
  const failed = report?.sources.filter((s) => !s.ok) ?? [];

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Job Matches</h1>
          <p className="mt-1 text-sm text-slate">
            SE and presales roles in Austin or US remote, from the <Link href="/admin/watchlist" className="underline underline-offset-2">Watchlist</Link>, the
            agency job board and Hacker News. Scanned once a day.
          </p>
        </div>
        <form action={scanNow}>
          <button className={ghost}>Scan now</button>
        </form>
      </div>

      {sp.error === "rate-limit" && <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">The model is busy this minute. Try again shortly.</p>}
      {sp.error === "fit" && <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">The Fit Check failed. Try again.</p>}

      <div className="mt-4 rounded-lg border border-line bg-card px-4 py-3 text-[13px] text-slate">
        {report ? (
          <>
            Last scan {ago(report.at)} ({formatDate(report.at)}): {report.sources.length} sources, {report.newMatches} new.
            {waiting > 0 && ` ${waiting} Fit Check${waiting === 1 ? "" : "s"} waiting; they run a few at a time with each email sync.`}
            {failed.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-amber-900">{failed.length} source{failed.length === 1 ? "" : "s"} failed</summary>
                <ul className="mt-1 list-disc pl-5">
                  {failed.map((s) => (
                    <li key={s.name}>
                      {s.name}: {s.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          "No scan yet. The first runs with the next email sync, or use Scan now."
        )}
      </div>

      <nav className="mt-6 flex gap-1 border-b border-line text-sm">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={v.id === "new" ? "/admin/jobs" : `/admin/jobs?view=${v.id}`}
            className={`-mb-px border-b-2 px-3 py-2 ${v.id === view ? "border-ink font-medium" : "border-transparent text-slate hover:text-ink"}`}
          >
            {v.label} <span className="text-slate">{counts[v.id]}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-slate">Nothing here.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((job) => (
            <li key={job.key} className="rounded-lg border border-line bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-slate">
                    {job.company} · {SOURCE[job.source]} · found {ago(job.firstSeen)}
                    {job.closedAt && ` · no longer listed`}
                  </p>
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block font-semibold hover:underline">
                    {job.title}
                  </a>
                  <p className="text-[13px] text-slate">{job.location}</p>
                </div>
                <ScoreBadge job={job} />
              </div>

              {job.fit ? (
                <details className="mt-3 text-[14px]">
                  <summary className="cursor-pointer">{job.fit.summary}</summary>
                  <div className="mt-2">
                    <FitCard fit={job.fit} checkedAt={job.fitCheckedAt} />
                  </div>
                </details>
              ) : (
                job.fitSkipped && <p className="mt-3 text-[13px] text-slate">{job.fitSkipped}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {job.status === "new" && (
                  <>
                    <form action={markApplied.bind(null, job.key)}>
                      <button className={button}>Mark applied</button>
                    </form>
                    <form action={dismissJob.bind(null, job.key)}>
                      <button className={ghost}>Not interested</button>
                    </form>
                    {!job.fit && job.description.length >= 200 && (
                      <form action={fitJobNow.bind(null, job.key)}>
                        <button className="px-2 text-sm text-slate underline underline-offset-2 hover:text-ink">Run Fit Check</button>
                      </form>
                    )}
                  </>
                )}
                {job.status === "applied" && job.applicationId && (
                  <Link href={`/admin/items/${job.applicationId}`} className={ghost}>
                    Open Application
                  </Link>
                )}
                {job.status === "dismissed" && (
                  <form action={restoreJob.bind(null, job.key)}>
                    <button className={ghost}>Move back to New</button>
                  </form>
                )}
                <a href={job.url} target="_blank" rel="noopener noreferrer" className="px-2 text-sm text-slate underline underline-offset-2 hover:text-ink">
                  Open posting
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
