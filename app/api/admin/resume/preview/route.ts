import { isAdmin } from "@/lib/admin/auth";
import { BASE } from "@/lib/resume/base";
import { fitToOnePage } from "@/lib/resume/pdf/render";
import { getResume, parseOwner } from "@/lib/resume/store";

// Live preview of a tailored resume draft for the editor (admin only).
//   GET ?owner=app:<id>|job:<key>&layout=designed|ats

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const owner = parseOwner(url.searchParams.get("owner") ?? "");
  if (!owner) return new Response("Bad owner", { status: 400 });
  const { draft } = await getResume(owner);
  if (!draft) return new Response("No draft yet", { status: 404 });
  const { designed, ats } = await fitToOnePage(draft, BASE);
  const pdf = url.searchParams.get("layout") === "ats" ? ats : designed;
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "cache-control": "no-store" } });
}
