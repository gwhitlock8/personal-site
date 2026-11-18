import { z } from "zod";
import { clientIp, logLead, rateLimit } from "@/lib/store";

export const runtime = "nodejs";

const Lead = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(200),
  company: z.string().trim().max(120).optional().default(""),
  note: z.string().trim().max(2000).optional().default(""),
  sessionId: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  if (!(await rateLimit(`lead:${clientIp(req)}`, 5, 3600))) {
    return Response.json({ error: "Too many submissions." }, { status: 429 });
  }
  const parsed = Lead.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Add your name and a valid email." }, { status: 400 });
  }
  await logLead(parsed.data);
  return Response.json({ ok: true });
}
