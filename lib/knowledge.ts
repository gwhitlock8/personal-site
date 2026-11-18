import fs from "node:fs";
import path from "node:path";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { experienceAsMarkdown } from "./profile";

// Step 1 of RAG: load and chunk the knowledge base.
//
// Each "## Heading" section becomes one LangChain Document, so a retrieved
// chunk is always a complete thought with its heading attached. Sections
// longer than ~1,200 characters get split further by the text splitter.

const CONTENT_DIR = path.join(process.cwd(), "content");

const PLACEHOLDER = /^(details coming soon\.?)?$/i;

function stripComments(md: string) {
  return md.replace(/<!--[\s\S]*?-->/g, "").trim();
}

function sectionsFromMarkdown(source: string, md: string) {
  const clean = stripComments(md);
  const title = clean.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? source;
  const parts = clean.split(/^##\s+/m).slice(1); // drop the "# Title" preamble

  return parts
    .map((part) => {
      const [heading, ...body] = part.split("\n");
      return { heading: heading.trim(), body: body.join("\n").trim() };
    })
    .filter((s) => s.body && !PLACEHOLDER.test(s.body))
    .map(
      (s) =>
        new Document({
          pageContent: `${title}: ${s.heading}\n${s.body}`,
          metadata: { source, title, section: s.heading },
        }),
    );
}

let cache: Promise<Document[]> | null = null;

export function loadKnowledge(): Promise<Document[]> {
  cache ??= (async () => {
    const files = fs
      .readdirSync(CONTENT_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        source: f.replace(/\.md$/, ""),
        md: fs.readFileSync(path.join(CONTENT_DIR, f), "utf8"),
      }));

    // Experience lives in lib/profile.ts so the homepage and the assistant agree.
    files.push({ source: "experience", md: experienceAsMarkdown() });

    const sections = files.flatMap((f) => sectionsFromMarkdown(f.source, f.md));

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1200,
      chunkOverlap: 150,
    });
    return splitter.splitDocuments(sections);
  })();
  return cache;
}

// A short profile that goes into every prompt, so basic questions
// ("where is he based?", "what does he do?") never depend on retrieval luck.
export async function coreProfile(): Promise<string> {
  const docs = await loadKnowledge();
  return docs
    .filter((d) => d.metadata.source === "profile")
    .map((d) => d.pageContent)
    .join("\n\n");
}
