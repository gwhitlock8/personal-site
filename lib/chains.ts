import { z } from "zod";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { Document } from "@langchain/core/documents";
import { loadKnowledge, coreProfile } from "./knowledge";
import { BM25Retriever } from "./retriever";
import { kimi } from "./model";
import { chatPrompt, fitPrompt, personaGuidance, type Persona } from "./prompts";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type Source = { source: string; section: string };

let retrieverPromise: Promise<BM25Retriever> | null = null;
async function getRetriever(k = 5) {
  retrieverPromise ??= loadKnowledge().then((docs) => new BM25Retriever({ docs, k }));
  return retrieverPromise;
}

function formatDocs(docs: Document[]) {
  if (!docs.length) return "(nothing relevant found)";
  return docs.map((d) => `[${d.metadata.source} / ${d.metadata.section}]\n${d.pageContent}`).join("\n\n---\n\n");
}

function toSources(docs: Document[]): Source[] {
  const seen = new Set<string>();
  return docs
    .map((d) => ({ source: String(d.metadata.source), section: String(d.metadata.section) }))
    .filter((s) => s.source !== "profile")
    .filter((s) => {
      const key = `${s.source}/${s.section}`;
      return seen.has(key) ? false : (seen.add(key), true);
    });
}

/**
 * The chat pipeline:
 *   question + recent history
 *     -> retriever (BM25 over knowledge sections)
 *     -> prompt template (system rules + persona + profile + context + history)
 *     -> Kimi K3
 *     -> string parser, streamed token by token
 */
export async function runChat(opts: { history: ChatTurn[]; question: string; persona?: Persona }) {
  const retriever = await getRetriever();

  // Include the previous user turn so follow-ups like "tell me more" still retrieve well.
  const lastUser = [...opts.history].reverse().find((m) => m.role === "user")?.content ?? "";
  const docs = await retriever.invoke(`${opts.question} ${lastUser}`.slice(0, 2000));

  const chain = chatPrompt.pipe(kimi()).pipe(new StringOutputParser());

  const stream = await chain.stream({
    persona: personaGuidance[opts.persona ?? "none"],
    profile: await coreProfile(),
    context: formatDocs(docs),
    history: opts.history.map((m) => (m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content))),
    question: opts.question,
  });

  return { stream, sources: toSources(docs) };
}

// ---- Job description fit check: structured output ----

export const FitSchema = z.object({
  summary: z.string().describe("Two sentences on overall fit, plainly stated."),
  matches: z
    .array(z.object({ requirement: z.string(), evidence: z.string() }))
    .describe("Requirements from the JD that Gavin clearly meets, with evidence."),
  gaps: z
    .array(z.object({ requirement: z.string(), note: z.string() }))
    .describe("Requirements Gavin doesn't clearly meet, with an honest note."),
});
export type Fit = z.infer<typeof FitSchema>;

export async function runFit(jd: string): Promise<{ fit: Fit; sources: Source[] }> {
  // The whole knowledge base is small (~3K words), so the fit check reads all of it.
  // Keyword retrieval alone missed relevant sections for long job descriptions and
  // produced false "gaps". Sections are ordered by relevance; the top ones become the chips.
  const all = await loadKnowledge();
  const ranked = new BM25Retriever({ docs: all, k: all.length }).score(jd).map((r) => r.doc);
  const docs = [...ranked, ...all.filter((d) => !ranked.includes(d))];

  // withStructuredOutput sends a JSON schema (response_format: json_schema)
  // generated from the Zod object, then parses and validates the reply.
  const model = kimi().withStructuredOutput(FitSchema, {
    name: "job_fit",
    method: "jsonSchema",
    strict: true,
  });

  const fit = await fitPrompt.pipe(model).invoke({
    profile: await coreProfile(),
    context: formatDocs(docs),
    jd,
  });
  return { fit, sources: toSources(ranked.slice(0, 6)) };
}
