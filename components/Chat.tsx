"use client";

import { useEffect, useRef, useState } from "react";
import { suggestedQuestions } from "@/lib/profile";

type Source = { source: string; section: string };
type Fit = {
  summary: string;
  matches: { requirement: string; evidence: string }[];
  gaps: { requirement: string; note: string }[];
};
type Msg = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  fit?: Fit;
  error?: boolean;
  pending?: boolean;
};
type Persona = "recruiter" | "hiring_manager" | "browsing";
type Mode = "chat" | "jd" | "lead";

const PERSONAS: { id: Persona; label: string }[] = [
  { id: "recruiter", label: "Recruiter" },
  { id: "hiring_manager", label: "Hiring manager" },
  { id: "browsing", label: "Just browsing" },
];

const SOURCE_NAMES: Record<string, string> = {
  experience: "Experience",
  skills: "Skills",
  "career-notes": "Career notes",
  references: "References",
  "this-site": "How this site works",
  profile: "Profile",
};

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi, I'm an assistant Gavin built to answer questions about his work. Ask me anything, or paste a job description to see how his background lines up.",
};

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [persona, setPersona] = useState<Persona | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [busy, setBusy] = useState(false);
  const sessionId = useRef<string>("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionId.current = crypto.randomUUID();
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, mode]);

  const started = messages.length > 1;

  function patchLast(patch: Partial<Msg>) {
    setMessages((m) => [...m.slice(0, -1), { ...m[m.length - 1], ...patch }]);
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setMode("chat");
    setBusy(true);

    const history = [...messages.slice(1), { role: "user" as const, content: q }];
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "", pending: true }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
          persona,
          sessionId: sessionId.current,
        }),
      });
      if (!res.ok || !res.body) {
        const { error } = await res.json().catch(() => ({ error: "" }));
        throw new Error(error || "The assistant is unavailable right now.");
      }

      const sources: Source[] = JSON.parse(decodeURIComponent(res.headers.get("X-Sources") ?? "%5B%5D"));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        patchLast({ content: text });
      }
      patchLast({ content: text || "I didn't get an answer back. Try asking again.", pending: false, sources });
    } catch (err) {
      patchLast({ content: (err as Error).message, error: true, pending: false });
    } finally {
      setBusy(false);
    }
  }

  async function checkFit(jd: string) {
    const text = jd.trim();
    if (!text || busy) return;
    setInput("");
    setMode("chat");
    setBusy(true);
    setMessages((m) => [
      ...m,
      { role: "user", content: `Job description (${text.split(/\s+/).length} words)` },
      { role: "assistant", content: "Comparing the job description with Gavin's background…", pending: true },
    ]);
    try {
      const res = await fetch("/api/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd: text, sessionId: sessionId.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The fit check failed.");
      patchLast({ content: "", fit: data.fit, sources: data.sources, pending: false });
    } catch (err) {
      patchLast({ content: (err as Error).message, error: true, pending: false });
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "jd") checkFit(input);
    else ask(input);
  }

  return (
    <div className="flex h-[min(700px,85vh)] flex-col overflow-hidden rounded-[14px] border border-ink/15 bg-card shadow-[0_1px_0_rgba(23,32,43,0.04),0_24px_48px_-28px_rgba(31,62,168,0.35)]">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">
          GW
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight">Ask about Gavin</p>
          <p className="text-[13px] text-slate">Runs on Kimi K3, an open-weight model, with LangChain.js</p>
        </div>
      </div>

      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-5 py-5 text-[15px] leading-relaxed" aria-live="polite">
        {messages.map((m, i) => (
          <Message key={i} msg={m} />
        ))}

        {!started && mode === "chat" && (
          <div className="space-y-5 pt-1">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-slate">Who's asking? (optional)</legend>
              <div className="flex flex-wrap gap-2">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={persona === p.id}
                    onClick={() => setPersona(persona === p.id ? null : p.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      persona === p.id ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-slate"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <p className="mb-2 text-[13px] font-medium text-slate">Try asking</p>
              <div className="flex flex-col items-start gap-2">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="rounded-lg border border-line bg-paper px-3 py-2 text-left text-sm text-ink/80 hover:border-cobalt hover:text-ink"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === "lead" && <LeadForm sessionId={sessionId.current} onDone={() => setMode("chat")} />}
      </div>

      <form onSubmit={submit} className="border-t border-line p-3">
        <div className="mb-2 flex gap-1 px-1 text-[13px]">
          <ModeTab active={mode === "chat"} onClick={() => setMode("chat")}>
            Ask a question
          </ModeTab>
          <ModeTab active={mode === "jd"} onClick={() => setMode("jd")}>
            Check fit for a role
          </ModeTab>
          <ModeTab active={mode === "lead"} onClick={() => setMode("lead")}>
            Leave your details
          </ModeTab>
        </div>
        {mode !== "lead" && (
          <div className="flex items-end gap-2 rounded-lg border border-line bg-paper px-3 py-2 focus-within:border-slate">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && mode === "chat") {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={mode === "jd" ? 5 : 1}
              maxLength={mode === "jd" ? 12000 : 4000}
              placeholder={mode === "jd" ? "Paste the full job description here" : "Ask about Gavin's experience"}
              aria-label={mode === "jd" ? "Job description" : "Your question"}
              className="max-h-48 flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none placeholder:text-slate/70"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-md bg-cobalt px-4 py-2 text-sm font-medium text-white hover:bg-cobalt-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {mode === "jd" ? "Check fit" : "Send"}
            </button>
          </div>
        )}
        <p className="mt-2 px-1 text-[12px] leading-snug text-slate">
          AI can make mistakes. Chats are saved so Gavin can improve the assistant, so don't share sensitive information.
        </p>
      </form>
    </div>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-2.5 py-1 ${active ? "bg-cobalt-soft font-medium text-cobalt-deep" : "text-slate hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function Message({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-paper">{msg.content}</p>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className={`max-w-[92%] ${msg.error ? "text-red-700" : ""}`}>
        {msg.fit ? (
          <FitCard fit={msg.fit} />
        ) : (
          <div className={`space-y-2 ${msg.pending ? "typing" : ""}`}>
            <RichText text={msg.content} />
          </div>
        )}
        {!msg.pending && msg.sources && msg.sources.length > 0 && <Sources sources={msg.sources} />}
      </div>
    </div>
  );
}

function Sources({ sources }: { sources: Source[] }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px]">
      <span className="text-slate">Answered from</span>
      {sources.slice(0, 4).map((s, i) => (
        <span
          key={`${s.source}/${s.section}`}
          className="chip-in rounded border border-cobalt/20 bg-cobalt-soft px-1.5 py-0.5 text-cobalt-deep"
          style={{ animationDelay: `${i * 60}ms` }}
          title={`${SOURCE_NAMES[s.source] ?? s.source}: ${s.section}`}
        >
          {SOURCE_NAMES[s.source] ?? s.source}: {s.section.replace(/\s*\(.*\)$/, "")}
        </span>
      ))}
    </div>
  );
}

function FitCard({ fit }: { fit: Fit }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className="font-medium">{fit.summary}</p>
      {fit.matches.length > 0 && (
        <>
          <h3 className="mt-4 text-[13px] font-semibold text-cobalt-deep">Where he matches</h3>
          <ul className="mt-1.5 space-y-2">
            {fit.matches.map((m, i) => (
              <li key={i} className="border-l-2 border-cobalt pl-3 text-[14px]">
                <span className="font-medium">{m.requirement}.</span> <span className="text-ink/80">{m.evidence}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {fit.gaps.length > 0 && (
        <>
          <h3 className="mt-4 text-[13px] font-semibold text-slate">Gaps to discuss</h3>
          <ul className="mt-1.5 space-y-2">
            {fit.gaps.map((g, i) => (
              <li key={i} className="border-l-2 border-line pl-3 text-[14px]">
                <span className="font-medium">{g.requirement}.</span> <span className="text-ink/80">{g.note}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Minimal markdown: paragraphs, "- " bullets and **bold**. Enough for chat replies.
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l) || !l.trim())) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.filter((l) => l.trim()).map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(block)}
          </p>
        );
      })}
    </>
  );
}

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

function LeadForm({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState("saving");
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...Object.fromEntries(form), sessionId }),
    });
    if (res.ok) setState("saved");
    else {
      setError((await res.json().catch(() => ({}))).error || "Your details weren't saved. Try again.");
      setState("error");
    }
  }

  if (state === "saved") {
    return (
      <div className="rounded-xl border border-line bg-paper p-4 text-sm">
        <p className="font-medium">Details saved. Gavin will be in touch.</p>
        <button type="button" onClick={onDone} className="mt-2 text-cobalt-deep underline underline-offset-2">
          Back to the chat
        </button>
      </div>
    );
  }

  const field = "w-full rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-slate";
  return (
    <form onSubmit={save} className="space-y-2.5 rounded-xl border border-line bg-paper p-4">
      <p className="text-sm font-medium">Leave your details and Gavin will reach out.</p>
      <input name="name" required placeholder="Name" aria-label="Name" className={field} />
      <input name="email" type="email" required placeholder="Work email" aria-label="Work email" className={field} />
      <input name="company" placeholder="Company and role (optional)" aria-label="Company and role" className={field} />
      <textarea name="note" rows={2} placeholder="Anything he should know (optional)" aria-label="Note" className={field} />
      {state === "error" && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={state === "saving"}
        className="rounded-md bg-cobalt px-4 py-2 text-sm font-medium text-white hover:bg-cobalt-deep disabled:opacity-50"
      >
        {state === "saving" ? "Saving…" : "Save my details"}
      </button>
    </form>
  );
}
