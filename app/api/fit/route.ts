import { runFit } from "@/lib/chains";
import { clientIp, logChat, rateLimit } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await rateLimit(clientIp(req), 5))) {
    return Response.json({ error: "Too many fit checks. Try again in a few minutes." }, { status: 429 });
  }

  const { jd, sessionId } = (await req.json().catch(() => ({}))) as { jd?: string; sessionId?: string };
  const text = (jd ?? "").trim().slice(0, 12000);
  if (text.length < 200) {
    return Response.json({ error: "Paste the full job description (at least a few paragraphs)." }, { status: 400 });
  }

  try {
    const result = await runFit(text);
    await logChat({ sessionId: String(sessionId ?? "anon").slice(0, 64), type: "fit", jd: text, fit: result.fit });
    return Response.json(result);
  } catch (err) {
    console.error("fit error", err);
    return Response.json({ error: "The fit check failed. Try again shortly." }, { status: 500 });
  }
}
