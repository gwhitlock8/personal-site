import { buildDigest } from "@/lib/admin/digest";
import { listJobs } from "@/lib/admin/job-scan";
import { listItems, listProposals } from "@/lib/admin/repo";
import { authorizedScript } from "@/lib/admin/script-auth";

// The weekday Digest, fetched by the Gmail Apps Script, which sends it from
// Gavin's Gmail. Returns { send: false } on quiet days.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!authorizedScript(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [items, proposals, jobs] = await Promise.all([listItems(), listProposals(), listJobs()]);
  return Response.json(buildDigest(items, proposals, new URL(req.url).origin, new Date(), jobs));
}
