import type { Metadata } from "next";
import Link from "next/link";
import { Header, Footer } from "@/components/Chrome";
import { profile } from "@/lib/profile";

export const metadata: Metadata = {
  title: "How I built the assistant | Gavin Whitlock",
  description: "Architecture of a RAG assistant built with Next.js, LangChain.js and the open-weight Kimi K3 model.",
};

const steps = [
  { title: "Browser", body: "Sends your question, recent messages and persona to /api/chat.", where: "React client" },
  { title: "API route", body: "Validates input, rate-limits per visitor, keeps the last 8 turns.", where: "Next.js on Vercel" },
  { title: "Retriever", body: "BM25 ranks sections of my resume and notes against the question.", where: "LangChain BaseRetriever" },
  { title: "Prompt", body: "Rules, persona, a fixed profile, retrieved sections and history.", where: "ChatPromptTemplate" },
  { title: "Model", body: "Writes the answer from that context only.", where: "Kimi K3 via Moonshot API" },
  { title: "Stream", body: "Tokens stream back; source sections ride in a response header.", where: "ReadableStream" },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-lg border border-ink/10 bg-ink p-4 text-[13px] leading-relaxed text-[#dfe6f0]">
      <code>{children.trim()}</code>
    </pre>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 max-w-[42rem] space-y-4 text-[1.0125rem] leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}

export default function HowIBuiltThis() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <Header />
      <main className="pb-10">
        <div className="max-w-[44rem] pb-12 pt-6">
          <h1 className="text-[2.4rem] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-5xl">
            How I built the assistant
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate">
            The assistant on my homepage is a retrieval-augmented generation (RAG) app. It searches a small set of files
            about my work, then asks an open-weight model to answer using only what it found. Here is each step and
            why I built it that way.
          </p>
        </div>

        <figure aria-label="Request flow" className="blueprint rounded-[14px] border border-ink/15 bg-card p-5 sm:p-7">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {steps.map((s, i) => (
              <li key={s.title} className="relative rounded-lg border border-line bg-card p-4">
                <p className="text-[13px] font-semibold text-cobalt">Step {i + 1}</p>
                <p className="mt-1 font-semibold">{s.title}</p>
                <p className="mt-1.5 text-[13px] leading-snug text-slate">{s.body}</p>
                <p className="mt-3 border-t border-line pt-2 text-[12px] text-ink/70">{s.where}</p>
              </li>
            ))}
          </ol>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-dashed border-cobalt/40 bg-cobalt-soft/60 p-4 text-[13px] leading-snug">
              <p className="font-semibold text-cobalt-deep">Knowledge base</p>
              <p className="mt-1 text-ink/75">
                Markdown files in <code>/content</code> plus structured resume data in <code>lib/profile.ts</code>, split
                into one chunk per section at startup.
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-cobalt/40 bg-cobalt-soft/60 p-4 text-[13px] leading-snug">
              <p className="font-semibold text-cobalt-deep">Upstash Redis</p>
              <p className="mt-1 text-ink/75">
                Stores chat logs and contact details, and backs the rate limiter. Optional: without it, logs go to the
                console.
              </p>
            </div>
          </div>
          <figcaption className="mt-4 text-[13px] text-slate">
            The job fit check follows the same path, but asks the model for structured JSON instead of streamed text.
          </figcaption>
        </figure>

        <Section title="Why Kimi K3, an open-weight model">
          <p>
            Most assistants like this call a closed model. I wanted to learn what changes with an open-weight one.
            Moonshot AI publishes Kimi K3's weights on Hugging Face, so the same model could run on my own GPUs with vLLM
            or SGLang, or on Amazon Bedrock, without rewriting the app.
          </p>
          <p>
            In practice K3 is a 2.8-trillion-parameter mixture-of-experts model, far too big for Vercel, so I call
            Moonshot's hosted API. That API is OpenAI-compatible, which means LangChain's standard <code>ChatOpenAI</code>{" "}
            class works once it points at a different URL:
          </p>
          <Code>{`
const model = new ChatOpenAI({
  model: "kimi-k3",
  apiKey: process.env.MOONSHOT_API_KEY,
  configuration: { baseURL: "https://api.moonshot.ai/v1" },
  modelKwargs: { reasoning_effort: "low" },
});`}</Code>
          <p>
            Two K3 details mattered. It always runs in thinking mode, and the default effort is <code>max</code>, which
            is too slow for chat, so I set it to <code>low</code>. And K3 fixes its own sampling settings, so the request
            must not include <code>temperature</code> or <code>top_p</code>. My test suite runs the chain against a fake
            server and checks for both.
          </p>
        </Section>

        <Section title="Why LangChain.js">
          <p>
            I write JavaScript and Node day to day, and Next.js runs natively on Vercel, so LangChain.js kept everything
            in one language and one repo. I use four of its building blocks: <code>Document</code> and a text splitter
            for the knowledge base, a <code>BaseRetriever</code> for search, <code>ChatPromptTemplate</code> for the
            prompt, and <code>withStructuredOutput</code> for the fit check. Each piece can be replaced on its own.
          </p>
          <Code>{`
const docs  = await retriever.invoke(question);
const chain = chatPrompt.pipe(kimi()).pipe(new StringOutputParser());
const stream = await chain.stream({ persona, profile, context: format(docs), history, question });`}</Code>
        </Section>

        <Section title="Retrieval without a vector database">
          <p>
            RAG tutorials usually start with an embeddings model and a vector store. Moonshot doesn't offer an embeddings
            endpoint, and my knowledge base is only a few thousand words, so I wrote a 60-line BM25 keyword retriever.
            It runs in memory, adds no service, and is easy to debug because you can see exactly why a section matched.
          </p>
          <p>
            Each <code>##</code> section of a markdown file becomes one chunk, so a retrieved chunk is always a complete
            thought with its heading. A short profile goes into every prompt no matter what, so basic questions never
            depend on retrieval. If the knowledge base grows, swapping in embeddings is one line, because anything that
            extends <code>BaseRetriever</code> fits the same slot.
          </p>
        </Section>

        <Section title="Structured output for the fit check">
          <p>
            When a hiring manager pastes a job description, a free-text answer is hard to scan. The fit route defines a
            Zod schema with a summary, matches with evidence, and gaps, and LangChain converts it to a JSON schema that K3
            is required to follow. The prompt asks for honest gaps, because a fit check that always says yes isn't useful.
          </p>
          <Code>{`
const model = kimi().withStructuredOutput(FitSchema, {
  name: "job_fit", method: "jsonSchema", strict: true,
});`}</Code>
        </Section>

        <Section title="What I left out, and why">
          <p>
            There's no agent loop yet. With tool calling, K3 requires the full assistant message, including its hidden
            reasoning, to be sent back unchanged on the next turn. That's easy to get wrong through an adapter, and a
            chain answers faster with fewer ways to fail. Contact capture uses a plain form instead of a tool call.
          </p>
          <p>
            Next I plan to move to a LangGraph agent with tools for lead capture and booking time, add an evaluation set
            of real questions from the chat logs, and compare K3 with other open-weight models through the same
            interface.
          </p>
        </Section>

        <Section title="Guardrails and privacy">
          <p>
            The system prompt limits answers to the knowledge files and tells the model to say when it doesn't know rather
            than guess. Inputs are length-capped, only recent turns are sent, and each visitor is rate-limited. API keys
            stay on the server. Visitors are told under the chat box that conversations are saved.
          </p>
        </Section>

        <div className="flex flex-wrap gap-3 border-t border-line pt-10">
          <Link href="/#chat" className="rounded-md bg-cobalt px-5 py-2.5 text-sm font-medium text-white hover:bg-cobalt-deep">
            Try the assistant
          </Link>
          <a
            href={profile.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-ink px-5 py-2.5 text-sm font-medium hover:bg-ink hover:text-paper"
          >
            See the code on GitHub
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
