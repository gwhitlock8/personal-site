import { ChatOpenAI } from "@langchain/openai";

// The model layer.
//
// Moonshot's API is OpenAI-compatible, so LangChain's ChatOpenAI class works
// as-is: point baseURL at Moonshot and pass the Kimi model id. Swapping to
// another OpenAI-compatible host (OpenRouter, Together, a self-hosted vLLM
// server running the open weights) is just a change of these env vars.
//
// Kimi K3 specifics (platform.kimi.ai docs):
//  - Thinking mode is always on. `reasoning_effort` is low | high | max
//    (default max). Low keeps chat replies fast.
//  - temperature, top_p, n and the penalties are fixed server-side and must
//    be omitted, so don't set them here.
//  - Streamed reasoning arrives in a separate `reasoning_content` field;
//    LangChain's `content` only carries the final answer, which is what we show.

export type Effort = "low" | "high" | "max";

export function kimi(effort?: Effort, opts: { timeoutMs?: number; maxRetries?: number } = {}) {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) throw new Error("MOONSHOT_API_KEY is not set. Copy .env.example to .env.local and add your key.");

  return new ChatOpenAI({
    model: process.env.KIMI_MODEL ?? "kimi-k3",
    apiKey,
    configuration: {
      baseURL: process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.ai/v1",
    },
    streamUsage: false,
    maxRetries: opts.maxRetries ?? 1,
    timeout: opts.timeoutMs ?? 60_000,
    modelKwargs: {
      reasoning_effort: effort ?? (process.env.KIMI_REASONING_EFFORT as Effort) ?? "low",
    },
  });
}
