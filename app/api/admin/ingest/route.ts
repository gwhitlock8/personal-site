import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ingestEmail, type IngestOutcome } from "@/lib/admin/ingest";
import { trackedThreads } from "@/lib/admin/repo";
import type { EmailRef } from "@/lib/admin/pipeline";

// Private endpoint for the Gmail Apps Script.
//   GET  -> thread ids the tracker follows, so the script can check them for replies
//   POST -> { messages: [...] } up to 10 at a time; returns an outcome per message
// Auth: "Authorization: Bearer <ADMIN_INGEST_SECRET>". No session cookie involved.

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BATCH = 10;

function authorized(req: Request): boolean {
  const secret = process.env.ADMIN_INGEST_SECRET;
  if (!secret || secret.length < 32) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const GmailId = z.string().regex(/^[0-9a-f]{8,32}$/i);
const Message = z.object({
  messageId: GmailId,
  threadId: GmailId,
  from: z.string().max(320),
  subject: z.string().max(1000),
  date: z.string().refine((d) => !Number.isNaN(Date.parse(d)), "invalid date"),
  snippet: z.string().max(5000),
  direction: z.enum(["in", "out"]),
});
const Body = z.object({ messages: z.array(Message).max(MAX_BATCH) });

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ threads: await trackedThreads() });
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid body", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });

  // One at a time, so two emails from the same company can't both create an Application.
  const results: { messageId: string; outcome: IngestOutcome }[] = [];
  for (const m of parsed.data.messages) {
    const email: EmailRef = {
      messageId: m.messageId,
      threadId: m.threadId,
      from: m.from.trim(),
      subject: m.subject.trim().slice(0, 300),
      date: new Date(m.date).toISOString(),
      snippet: m.snippet.replace(/\s+/g, " ").trim().slice(0, 300),
      direction: m.direction,
      link: `https://mail.google.com/mail/u/0/#all/${m.threadId}`,
    };
    try {
      results.push({ messageId: m.messageId, outcome: await ingestEmail(email) });
    } catch (err) {
      console.error("ingest error", m.messageId, err);
      results.push({ messageId: m.messageId, outcome: "error" }); // not marked seen, so the next run retries it
    }
  }
  return Response.json({ results });
}
