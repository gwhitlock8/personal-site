import { jobTick } from "@/lib/admin/job-scan";
import { authorizedScript } from "@/lib/admin/script-auth";

// Job Matches: called by the Gmail Apps Script after each sync (every 15 minutes).
// Scans the Watchlist and Aggregators once a day, then runs a few Fit Checks.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!authorizedScript(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await jobTick();
  return Response.json({
    scanned: result.scanned,
    newMatches: result.report?.newMatches ?? 0,
    failedSources: result.report?.sources.filter((s) => !s.ok).map((s) => s.name) ?? [],
    fitChecked: result.fitChecked,
    fitPending: result.fitPending,
    stoppedBy: result.stoppedBy ?? null,
  });
}
