"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { RateLimited } from "@/lib/admin/ingest";
import { fitJob, getJob, getWatchlist, jobTick, saveJob, saveWatchlist } from "@/lib/admin/job-scan";
import { boardUrl, fetchBoard } from "@/lib/admin/job-sources";
import { parseBoardInput, type WatchlistCompany } from "@/lib/admin/jobs";
import { addEvent, newId, saveItem } from "@/lib/admin/repo";
import type { Application } from "@/lib/admin/pipeline";
import { getResume, moveOwner } from "@/lib/resume/store";

const refresh = () => revalidatePath("/admin", "layout");

async function loadJob(key: string) {
  await requireAdmin();
  const job = await getJob(key);
  if (!job) redirect("/admin/jobs");
  return job;
}

// ---- Job Matches ----

/** Creates an Application from a Job Match, carrying over the description and Fit Check. */
export async function markApplied(key: string) {
  const job = await loadJob(key);
  if (job.status === "applied" && job.applicationId) redirect(`/admin/items/${job.applicationId}`);
  const now = new Date().toISOString();
  const app: Application = {
    id: newId(),
    kind: "application",
    company: job.company,
    role: job.title,
    url: job.url,
    location: job.location || undefined,
    stage: "Applied",
    appliedOn: now.slice(0, 10),
    jobDescription: job.description.length >= 200 ? job.description : undefined,
    fit: job.fit,
    fitCheckedAt: job.fitCheckedAt,
    source: "job-match",
    createdAt: now,
    updatedAt: now,
    lastEventAt: now,
  };
  // A resume tailored before applying moves to the new Application.
  const tailored = await getResume({ kind: "job", key: job.key });
  if (tailored.saved.length) app.resumeVersion = `Tailored (${tailored.saved[0].at.slice(0, 10)})`;
  await moveOwner({ kind: "job", key: job.key }, { kind: "app", id: app.id });
  await saveItem(app);
  await addEvent(app, "created", "Applied (from a Job Match)", job.url);
  job.status = "applied";
  job.applicationId = app.id;
  await saveJob(job);
  refresh();
  redirect(`/admin/items/${app.id}`);
}

export async function dismissJob(key: string) {
  const job = await loadJob(key);
  job.status = "dismissed";
  await saveJob(job);
  refresh();
}

export async function restoreJob(key: string) {
  const job = await loadJob(key);
  job.status = "new";
  delete job.applicationId;
  await saveJob(job);
  refresh();
}

export async function fitJobNow(key: string) {
  const job = await loadJob(key);
  delete job.fitSkipped;
  try {
    await fitJob(job);
  } catch (err) {
    if (err instanceof RateLimited) redirect("/admin/jobs?error=rate-limit");
    console.error("job fit check failed", err);
    redirect("/admin/jobs?error=fit");
  }
  refresh();
}

export async function scanNow() {
  await requireAdmin();
  await jobTick({ force: true, maxFits: 0 });
  refresh();
  redirect("/admin/jobs?scanned=1");
}

// ---- Watchlist ----

export async function addCompany(form: FormData) {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const parsed = parseBoardInput(String(form.get("board") ?? "").slice(0, 300), String(form.get("ats") ?? ""));
  if (!name || !parsed) redirect("/admin/watchlist?error=input");

  const list = await getWatchlist();
  const id = `${parsed.ats}:${parsed.board}`;
  if (list.some((c) => c.id.toLowerCase() === id.toLowerCase())) redirect("/admin/watchlist?error=duplicate");

  const company: WatchlistCompany = { id, name, ...parsed, fdeIsPresales: form.get("fde") === "on" || undefined, addedAt: new Date().toISOString() };
  let count = 0;
  try {
    count = (await fetchBoard(company)).length;
  } catch {
    redirect(`/admin/watchlist?error=board&tried=${encodeURIComponent(boardUrl(company))}`);
  }
  await saveWatchlist([...list, company]);
  refresh();
  redirect(`/admin/watchlist?added=${encodeURIComponent(name)}&count=${count}`);
}

export async function removeCompany(id: string) {
  await requireAdmin();
  await saveWatchlist((await getWatchlist()).filter((c) => c.id !== id));
  refresh();
}

export async function toggleFde(id: string) {
  await requireAdmin();
  const list = await getWatchlist();
  const c = list.find((x) => x.id === id);
  if (c) c.fdeIsPresales = !c.fdeIsPresales || undefined;
  await saveWatchlist(list);
  refresh();
}
