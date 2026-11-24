import type { SourceRef } from "./sources";

// Truth checks run on every line of a tailored resume, after generation and
// after each edit. Flags warn; blocked terms also stop the PDF from saving.

export type Line = { text: string; sources: string[]; priority?: number };

export type Flag = { kind: "no-source" | "unknown-source" | "number" | "copied" | "blocked"; detail: string };

const COPY_RUN = 6;

const NUMBER = /\$?\d[\d,.]*\s?(%|k|m|x|×)?/gi;
const normNumber = (t: string) => t.toLowerCase().replace(/[,\s+]/g, "").replace(/[.]$/, "");
const numbersIn = (text: string) => (text.match(NUMBER) ?? []).map(normNumber).filter((n) => /\d/.test(n));

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

function runs(text: string): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + COPY_RUN <= w.length; i++) out.add(w.slice(i, i + COPY_RUN).join(" "));
  return out;
}

/** Terms that must never appear: the customer's name, a phone number, or "architect" outside the real job title. */
export function blockedTerms(text: string): string[] {
  const found: string[] = [];
  if (/american express/i.test(text)) found.push("American Express");
  const amex = text.match(/\bamex\b/i);
  if (amex) found.push(amex[0]);
  if (/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(text)) found.push("phone number");
  if (/\barchitect/i.test(text.replace(/AI Solution Architect/g, ""))) found.push("architect");
  return found;
}

export function checkLine(line: Line, sources: Map<string, SourceRef>, posting: string): Flag[] {
  const flags: Flag[] = [];
  const cited = line.sources.map((id) => sources.get(id));
  const unknown = line.sources.filter((_, i) => !cited[i]);
  if (!line.sources.length) flags.push({ kind: "no-source", detail: "No source cited for this line." });
  else if (unknown.length) flags.push({ kind: "unknown-source", detail: `Unknown source: ${unknown.join(", ")}` });

  const sourceText = cited
    .filter((s): s is SourceRef => !!s)
    .map((s) => s.text)
    .join(" ");
  const known = new Set(numbersIn(sourceText));
  const missing = numbersIn(line.text).filter((n) => !known.has(n));
  if (missing.length) flags.push({ kind: "number", detail: `Not in the cited sources: ${[...new Set(missing)].join(", ")}` });

  if (posting) {
    const posted = runs(posting);
    const shared = [...runs(line.text)].find((r) => posted.has(r));
    if (shared) flags.push({ kind: "copied", detail: `Same wording as the posting: "${shared}"` });
  }

  const blocked = blockedTerms(line.text);
  if (blocked.length) flags.push({ kind: "blocked", detail: `Remove before saving: ${blocked.join(", ")}` });
  return flags;
}
