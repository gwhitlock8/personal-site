import { runChat, type ChatTurn } from "@/lib/chains";
import type { Persona } from "@/lib/prompts";
import { clientIp, logChat, rateLimit } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const PERSONAS: Persona[] = ["recruiter", "hiring_manager", "browsing"];
const MAX_CHARS = 4000;
const MAX_HISTORY = 8;

type ChatRequest = { messages?: ChatTurn[]; persona?: string; sessionId?: string };

export async function POST(req: Request) {
  if (!(await rateLimit(clientIp(req)))) {
    return Response.json({ error: "Too many messages. Try again in a few minutes." }, { status: 429 });
  }

  let input: ChatRequest;
  try {
    input = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const messages = (input.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    // Moonshot rejects empty messages, so drop them (e.g. an interrupted reply).
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  const last = messages.at(-1);
  if (!last || last.role !== "user" || !last.content.trim()) {
    return Response.json({ error: "Send a question." }, { status: 400 });
  }

  const persona = PERSONAS.includes(input.persona as Persona) ? (input.persona as Persona) : undefined;
  const sessionId = String(input.sessionId ?? "anon").slice(0, 64);
  const history = messages.slice(0, -1).slice(-MAX_HISTORY);

  try {
    const { stream, sources } = await runChat({ history, question: last.content, persona });

    // Pipe LangChain's async string stream into a web ReadableStream.
    // Sources travel in a response header so the body stays plain text.
    const encoder = new TextEncoder();
    let answer = "";
    const output = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            answer += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          console.error("stream error", err);
          controller.enqueue(encoder.encode("\n\nThe model stopped responding. Try asking again."));
        } finally {
          controller.close();
          await logChat({ sessionId, persona, question: last.content, answer, sources });
        }
      },
    });

    return new Response(output, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Sources": encodeURIComponent(JSON.stringify(sources)),
      },
    });
  } catch (err) {
    console.error("chat error", err);
    const msg =
      err instanceof Error && err.message.includes("MOONSHOT_API_KEY")
        ? err.message
        : "The assistant is unavailable right now. Try again shortly.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
