import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";
import type { Document } from "@langchain/core/documents";

// Step 2 of RAG: retrieval.
//
// Moonshot doesn't offer an embeddings API, and the knowledge base is small,
// so this is a classic BM25 keyword ranker instead of a vector store.
// Because it extends LangChain's BaseRetriever, it plugs into chains exactly
// like a vector store retriever would. To switch later:
//   const retriever = vectorStore.asRetriever({ k: 5 });

const STOPWORDS = new Set(
  "a an and are as at be but by did do does for from has have he her his how i in is it its me my of on or our she so that the their them they this to was we what when where which who why will with you your about tell can".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$%+.\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export interface BM25RetrieverInput extends BaseRetrieverInput {
  docs: Document[];
  k?: number;
  k1?: number;
  b?: number;
}

export class BM25Retriever extends BaseRetriever {
  lc_namespace = ["personal_site", "retrievers"];

  private docs: Document[];
  private k: number;
  private k1: number;
  private b: number;
  private tokens: string[][];
  private avgLen: number;
  private df = new Map<string, number>();

  constructor(fields: BM25RetrieverInput) {
    super(fields);
    this.docs = fields.docs;
    this.k = fields.k ?? 5;
    this.k1 = fields.k1 ?? 1.5;
    this.b = fields.b ?? 0.75;

    // Index section headings twice so a heading match counts extra.
    this.tokens = this.docs.map((d) =>
      tokenize(`${d.metadata.section ?? ""} ${d.metadata.section ?? ""} ${d.pageContent}`),
    );
    this.avgLen = this.tokens.reduce((n, t) => n + t.length, 0) / Math.max(this.tokens.length, 1);
    for (const toks of this.tokens) {
      for (const term of new Set(toks)) this.df.set(term, (this.df.get(term) ?? 0) + 1);
    }
  }

  score(query: string): { doc: Document; score: number }[] {
    const terms = [...new Set(tokenize(query))];
    const N = this.docs.length;
    return this.docs
      .map((doc, i) => {
        const toks = this.tokens[i];
        let score = 0;
        for (const term of terms) {
          const tf = toks.filter((t) => t === term).length;
          if (!tf) continue;
          const df = this.df.get(term) ?? 0;
          const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
          score +=
            (idf * tf * (this.k1 + 1)) /
            (tf + this.k1 * (1 - this.b + (this.b * toks.length) / this.avgLen));
        }
        return { doc, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    return this.score(query)
      .slice(0, this.k)
      .map((r) => r.doc);
  }
}
