import { runFit } from "@/lib/chains";
import { adminDb } from "./db";
import { experienceAsContext, listExperience } from "./experience";
import { RateLimited } from "./ingest";
import { fetchBoard, fetchHnWhoIsHiring, fetchNotionBoard } from "./job-sources";
import { fitScore, normalizeUrl, postingQualifies, type JobMatch, type Posting, type WatchlistCompany } from "./jobs";
import { companiesMatch, roleSimilarity } from "./matching";
import type { Application, Item } from "./pipeline";
import { listItems, takeModelBudget } from "./repo";
import { WATCHLIST_SEED } from "./watchlist-seed";

// Storage layout in the admin database:
//   watchlist        JSON array of Watchlist companies (seeded on first read)
//   jobs             sorted set of Job Match keys, scored by firstSeen
//   job:<key>        JSON of a Job Match
//   jobs:lastScan    ISO time of the last full scan
//   jobs:scanReport  JSON summary of the last scan, shown on /admin/jobs

const jobKey = (key: string) => `job:${key}`;
const SCAN_EVERY_MS = 20 * 3_600_000; // once a day, with slack for the 15-minute tick
const MIN_DESCRIPTION = 200;
const CONCURRENCY = 8;

// ---- Watchlist ----

export async function getWatchlist(): Promise<WatchlistCompany[]> {
  const raw = await adminDb().get("watchlist");
  if (raw) return JSON.parse(raw) as WatchlistCompany[];
  await saveWatchlist(WATCHLIST_SEED);
  return WATCHLIST_SEED;
}

export async function saveWatchlist(list: WatchlistCompany[]) {
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
  await adminDb().set("watchlist", JSON.stringify(sorted));
}

// ---- Job Matches ----

export async function listJobs(): Promise<JobMatch[]> {
  const db = adminDb();
  const keys = await db.zrevAll("jobs");
  const raw = await db.mget(keys.map(jobKey));
  return raw.filter((r): r is string => !!r).map((r) => JSON.parse(r) as JobMatch);
}

export async function getJob(key: string): Promise<JobMatch | null> {
  const raw = await adminDb().get(jobKey(key));
  return raw ? (JSON.parse(raw) as JobMatch) : null;
}

export async function saveJob(job: JobMatch) {
  const db = adminDb();
  await db.set(jobKey(job.key), JSON.stringify(job));
  await db.zadd("jobs", Date.parse(job.firstSeen), job.key);
}

export type SourceReport = { name: string; ok: boolean; postings: number; matches: number; error?: string };
export type ScanReport = { at: string; newMatches: number; sources: SourceReport[] };

export async function lastScanReport(): Promise<ScanReport | null> {
  const raw = await adminDb().get("jobs:scanReport");
  return raw ? (JSON.parse(raw) as ScanReport) : null;
}

/** An Application already covering this posting (same company, similar role). */
export function findApplication(items: Item[], p: Pick<Posting, "company" | "title" | "url">): Application | undefined {
  const apps = items.filter((i): i is Application => i.kind === "application");
  const byUrl = apps.find((a) => a.url && normalizeUrl(a.url) === normalizeUrl(p.url));
  if (byUrl) return byUrl;
  return apps.find((a) => companiesMatch(a.company, p.company) && roleSimilarity(a.role, p.title) >= 0.6);
}

export type Fetchers = {
  board: (c: WatchlistCompany) => Promise<Posting[]>;
  hn: () => Promise<Posting[]>;
  notion: () => Promise<Posting[]>;
};
const liveFetchers: Fetchers = { board: fetchBoard, hn: fetchHnWhoIsHiring, notion: fetchNotionBoard };

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/**
 * Reads every source, keeps postings that meet the search criteria, and saves new
 * Job Matches. One failing source never stops the others; it shows in the report.
 * Postings already applied to are recorded as applied, so they never show as new.
 */
export async function scanJobs(now = new Date(), fetchers: Fetchers = liveFetchers): Promise<ScanReport> {
  const watchlist = await getWatchlist();
  const [existing, items] = await Promise.all([listJobs(), listItems()]);
  const byKey = new Map(existing.map((j) => [j.key, j]));
  const byUrl = new Map(existing.map((j) => [normalizeUrl(j.url), j.key]));
  const iso = now.toISOString();

  type Batch = { report: SourceReport; postings: Posting[]; scope?: (j: JobMatch) => boolean };
  const run = async (name: string, get: () => Promise<Posting[]>, opts: { fde?: boolean; scope?: (j: JobMatch) => boolean }): Promise<Batch> => {
    try {
      const all = await get();
      const postings = all.filter((p) => postingQualifies(p, { fdeIsPresales: opts.fde }));
      return { report: { name, ok: true, postings: all.length, matches: postings.length }, postings, scope: opts.scope };
    } catch (err) {
      return { report: { name, ok: false, postings: 0, matches: 0, error: String((err as Error)?.message ?? err).slice(0, 200) }, postings: [] };
    }
  };

  const batches = [
    ...(await pool(watchlist, CONCURRENCY, (c) =>
      run(c.name, () => fetchers.board(c), { fde: c.fdeIsPresales, scope: (j) => j.watchlistId === c.id }),
    )),
    await run("Hacker News: Who is hiring?", fetchers.hn, { scope: (j) => j.source === "hn" }),
    await run("Recruiting agency job board (PreSales)", fetchers.notion, { scope: (j) => j.source === "notion" }),
  ];

  let newMatches = 0;
  for (const b of batches) {
    const seen = new Set<string>();
    for (const p of b.postings) {
      const dupeKey = byKey.has(p.key) ? p.key : byUrl.get(normalizeUrl(p.url));
      const known = dupeKey ? byKey.get(dupeKey) : undefined;
      if (known) {
        seen.add(known.key);
        known.lastSeen = iso;
        delete known.closedAt;
        await saveJob(known);
        continue;
      }
      const applied = findApplication(items, p);
      const job: JobMatch = {
        key: p.key,
        source: p.source,
        company: p.company,
        title: p.title,
        location: p.locations[0] ?? (p.remote ? "Remote" : ""),
        locations: p.locations,
        url: p.url,
        description: p.description,
        postedAt: p.postedAt,
        watchlistId: p.watchlistId,
        firstSeen: iso,
        lastSeen: iso,
        status: applied ? "applied" : "new",
        applicationId: applied?.id,
      };
      await saveJob(job);
      byKey.set(job.key, job);
      byUrl.set(normalizeUrl(job.url), job.key);
      seen.add(job.key);
      if (!applied) newMatches++;
    }
    // A source that answered but no longer lists a match: the role closed.
    if (b.report.ok && b.scope) {
      for (const j of existing) {
        if (b.scope(j) && !seen.has(j.key) && !j.closedAt) {
          j.closedAt = iso;
          await saveJob(j);
        }
      }
    }
  }

  const report: ScanReport = { at: iso, newMatches, sources: batches.map((b) => b.report) };
  const db = adminDb();
  await db.set("jobs:lastScan", iso);
  await db.set("jobs:scanReport", JSON.stringify(report));
  return report;
}

// ---- Fit Checks ----

export type FitRunner = (jd: string, extra?: string) => Promise<{ fit: JobMatch["fit"] & object }>;

/** Runs the Fit Check for one Job Match, held to the shared model budget. */
export async function fitJob(job: JobMatch, run: FitRunner = runFit): Promise<void> {
  if (job.description.length < MIN_DESCRIPTION) {
    job.fitSkipped = "The posting has too little text for a Fit Check. Open it and paste the description into the Application after you apply.";
    await saveJob(job);
    return;
  }
  if (!(await takeModelBudget())) throw new RateLimited();
  try {
    const extra = experienceAsContext(await listExperience());
    const { fit } = await run(`${job.title} at ${job.company}\nLocation: ${job.locations.join(", ")}\n\n${job.description}`, extra);
    job.fit = fit;
    job.fitScore = fitScore(fit);
    job.fitCheckedAt = new Date().toISOString();
    delete job.fitSkipped;
    await saveJob(job);
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 429 || /\b429\b|rate limit|max RPM/i.test(String((err as Error)?.message))) throw new RateLimited();
    throw err;
  }
}

export const needsFit = (j: JobMatch) => j.status === "new" && !j.closedAt && !j.fit && !j.fitSkipped;

export type TickResult = { scanned: boolean; report?: ScanReport; fitChecked: number; fitPending: number; stoppedBy?: string };

/**
 * Called by the Apps Script every 15 minutes. Scans once a day, then runs a few
 * Fit Checks, stopping early when time or the model budget runs out.
 */
export async function jobTick(opts: { force?: boolean; now?: Date; fetchers?: Fetchers; fit?: FitRunner; maxFits?: number; timeLimitMs?: number } = {}): Promise<TickResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const last = await adminDb().get("jobs:lastScan");
  const due = opts.force || !last || now.getTime() - Date.parse(last) >= SCAN_EVERY_MS;
  const report = due ? await scanJobs(now, opts.fetchers) : undefined;

  const timeLimit = opts.timeLimitMs ?? 40_000;
  const maxFits = opts.maxFits ?? (due ? 2 : 4);
  const queue = (await listJobs()).filter(needsFit);
  let fitChecked = 0;
  let stoppedBy: string | undefined;
  for (const job of queue) {
    if (fitChecked >= maxFits) break;
    if (Date.now() - started > timeLimit) {
      stoppedBy = "time";
      break;
    }
    try {
      await fitJob(job, opts.fit);
      fitChecked++;
    } catch (err) {
      if (err instanceof RateLimited) {
        stoppedBy = "rate-limit";
        break;
      }
      console.error("job fit check failed", job.key, err);
      job.fitSkipped = "The Fit Check failed; use Run Fit Check to retry.";
      await saveJob(job);
    }
  }
  const fitPending = queue.length - fitChecked;
  return { scanned: due, report, fitChecked, fitPending, stoppedBy };
}
