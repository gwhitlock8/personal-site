import { get } from "@vercel/blob";
import { isAdmin } from "@/lib/admin/auth";

// Downloads a saved resume PDF from the private Blob store (admin only).
//   GET ?url=<blob url>&name=<file name>

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const params = new URL(req.url).searchParams;
  const blobUrl = params.get("url") ?? "";
  let host = "";
  try {
    host = new URL(blobUrl).hostname;
  } catch {
    // fall through to 400
  }
  if (!host.endsWith(".blob.vercel-storage.com")) return new Response("Bad file", { status: 400 });
  const name = (params.get("name") ?? "resume.pdf").replace(/[^A-Za-z0-9._-]/g, "") || "resume.pdf";
  const result = await get(blobUrl, { access: "private" });
  if (!result) return new Response("Not found", { status: 404 });
  return new Response(result.stream, {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store" },
  });
}
