import { timingSafeEqual } from "node:crypto";

// Auth for requests from the Gmail Apps Script: "Authorization: Bearer <ADMIN_INGEST_SECRET>".
// Used by /api/admin/ingest and /api/admin/digest. No session cookie involved.

export function authorizedScript(req: Request): boolean {
  const secret = process.env.ADMIN_INGEST_SECRET;
  if (!secret || secret.length < 32) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
