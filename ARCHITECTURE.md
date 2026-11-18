# Architecture

This is a retrieval-augmented generation (RAG) assistant. When a visitor asks a question, the app finds the most relevant sections of my resume and notes, puts them in a prompt, and an open-weight model writes an answer from that context only.

```
Browser (components/Chat.tsx)
   │  POST /api/chat { messages, persona, sessionId }
   ▼
Next.js API route on Vercel (app/api/chat/route.ts)
   │  validate input, rate-limit by IP, keep last 8 turns
   ▼
Retriever (lib/retriever.ts)  ◄── Knowledge base (lib/knowledge.ts)
   │  BM25 picks top 5 sections       content/*.md + lib/profile.ts,
   │                                  one chunk per "##" section
   ▼
Prompt (lib/prompts.ts)
   │  rules + persona + core profile + retrieved sections + history + question
   ▼
Kimi K3 via Moonshot API (lib/model.ts)
   │  OpenAI-compatible, reasoning_effort=low
   ▼
StringOutputParser → ReadableStream → browser renders tokens as they arrive
   │  X-Sources header → "Answered from" chips
   └─ on finish: log to Upstash Redis (lib/store.ts)
```

The job fit check (`/api/fit`) follows the same path. It retrieves 8 sections instead of 5, and it uses `withStructuredOutput` with a Zod schema, so the result is validated JSON (summary, matches, gaps) rendered as a card.

## Files

| File | Job |
| --- | --- |
| `lib/profile.ts` | Structured resume data. The homepage renders it, and it also becomes a knowledge document, so both agree. |
| `content/*.md` | Free-form knowledge: profile, skills, career stories, references, how the site works. |
| `lib/knowledge.ts` | Loads files, strips TODO comments and empty sections, splits into LangChain `Document`s. |
| `lib/retriever.ts` | BM25 ranking, implemented as a LangChain `BaseRetriever`. |
| `lib/model.ts` | `ChatOpenAI` configured for Moonshot and Kimi K3. |
| `lib/prompts.ts` | System rules, persona guidance, chat and fit templates. |
| `lib/chains.ts` | Wires retriever → prompt → model for chat (streaming) and fit (structured). |
| `lib/store.ts` | Upstash Redis for logs, leads and the rate limiter. No-ops locally. |
| `app/api/*` | HTTP layer: validation, limits, streaming, errors. |
| `scripts/test-retrieval.ts` | Offline tests, including a fake Moonshot server that checks the exact request. |

## Decisions and tradeoffs

**Open-weight model, hosted API.** Kimi K3's weights are public, but it's a 2.8T-parameter MoE that needs a GPU cluster. Moonshot's hosted API gives the same model without running GPUs. Because the API is OpenAI-compatible, moving to self-hosted vLLM, Bedrock or OpenRouter means changing `MOONSHOT_BASE_URL` and `KIMI_MODEL`, not code.

**K3-specific settings.** Thinking is always on, and the default effort is `max`, which is too slow for chat, so we send `reasoning_effort: "low"`. Temperature, top_p and the penalty params are fixed by Moonshot and must be omitted. The test suite asserts both. Reasoning comes back in a separate `reasoning_content` field, and LangChain's `content` only holds the final answer, so hidden reasoning never reaches the visitor.

**BM25 instead of embeddings.** Moonshot has no embeddings endpoint. The corpus is about 30 chunks, so a keyword ranker is accurate enough, costs nothing, adds no service, and is easy to debug. It implements `BaseRetriever`, so a vector store can replace it in one line.

**Section-level chunks plus a fixed profile.** Splitting on `##` headings keeps each chunk a complete thought with its title. The short profile is always in the prompt, so basic facts never depend on retrieval.

**Chain, not agent.** K3 requires the full assistant message, including `reasoning_content`, to be sent back on tool-calling turns. LangChain's OpenAI adapter doesn't reliably round-trip that field. A single-pass chain avoids the problem and responds faster. Lead capture is a plain form instead of a tool.

**Plain-text streaming.** The route streams raw text and puts sources in a response header. That's simpler than server-sent events or the Vercel AI SDK protocol, and easy to read in devtools.

**Guardrails.** Answer only from context and admit gaps. Never invent numbers or references. Ignore prompt-injection attempts. Inputs are length-capped, history is trimmed, visitors are rate-limited, and keys stay on the server.

## Explaining it in an interview (2 minutes)

1. **What it is.** "It's a RAG assistant over my resume and career notes, running on Kimi K3, an open-weight model, with LangChain.js on Vercel."
2. **Request path.** "The question goes to a Next.js route. A retriever pulls the five most relevant sections, a prompt template combines them with rules and the visitor's persona, and K3 streams the answer back. The chips under each reply show which sections it used, so you can check the grounding."
3. **One interesting decision.** "Moonshot has no embeddings API, and my corpus is tiny, so I wrote a BM25 retriever behind LangChain's retriever interface. It's free, deterministic and swappable."
4. **One thing I deliberately didn't do.** "No agent loop yet. K3's thinking mode requires round-tripping reasoning tokens on tool calls, which adapters handle poorly. A chain was faster and more reliable for v1."
5. **How I'd take it to production for a customer.** "Evals from real chat logs, embeddings once the corpus grows, LangGraph for tools, and tracing with LangSmith."

## Next steps

- Fill in `content/career-notes.md` with 4 to 6 real stories. This improves answer quality more than anything else.
- Add an eval set: 20 real questions with expected facts, run with `npm run ask` in a loop.
- Add LangSmith tracing (`LANGSMITH_TRACING=true` plus an API key) to see each retrieval and prompt.
- Move to LangGraph with `save_contact` and `book_time` tools once reasoning round-tripping is handled.
- Compare K3 against another open-weight model behind the same `kimi()` factory.
