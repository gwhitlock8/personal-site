import type { WatchlistCompany } from "./jobs";

// The starting Watchlist: AI and data companies whose job boards were checked
// live in November 2026. Editable afterwards on /admin/watchlist; this list is
// only used the first time the Watchlist is read.

const ashby: [string, string, boolean?][] = [
  ["Rox", "Rox-Data-Corp"], ["Cognition", "cognition"], ["Perplexity", "perplexity"], ["Harvey", "harvey"],
  ["Sierra", "sierra"], ["Decagon", "decagon"], ["Clay", "claylabs"], ["ElevenLabs", "elevenlabs"],
  ["LangChain", "langchain", true], ["Cohere", "cohere"], ["Hex", "hex"], ["Notion", "notion"],
  ["Monte Carlo", "montecarlodata"], ["Kognitos", "kognitos"], ["Blitzy", "blitzy"], ["Rogo", "rogo"],
  ["Replit", "replit"], ["Baseten", "baseten"], ["Modal", "modal"], ["LlamaIndex", "llamaindex"],
  ["Writer", "writer"], ["OpenAI", "openai"], ["Ramp", "ramp"], ["Abridge", "abridge"],
  ["Lovable", "lovable"], ["Vapi", "vapi"], ["Pinecone", "pinecone"], ["Unstructured", "unstructured"],
  ["Cursor", "cursor"], ["Stack AI", "stack-ai"], ["Temporal", "temporal"], ["Interface", "interface"],
  ["Attio", "attio"], ["Unify", "unify"], ["Weaviate", "weaviate"], ["Supabase", "supabase"],
  ["n8n", "n8n"], ["Vanta", "vanta"], ["Drata", "drata"], ["Linear", "linear"],
];

const greenhouse: [string, string][] = [
  ["Snorkel AI", "snorkelai"], ["Glean", "gleanwork"], ["Anthropic", "anthropic"], ["Scale AI", "scaleai"],
  ["Together AI", "togetherai"], ["Cresta", "cresta"], ["Vercel", "vercel"], ["Airtable", "airtable"],
  ["HumanSignal", "humansignal"], ["Arize AI", "arizeai"], ["Gong", "gongio"], ["Sigma Computing", "sigmacomputing"],
  ["Fivetran", "fivetran"], ["Celonis", "celonis"], ["Workato", "workato"], ["Torq", "torq"],
];

export const WATCHLIST_SEED: WatchlistCompany[] = [
  ...ashby.map(([name, board, fde]) => ({ id: `ashby:${board}`, name, ats: "ashby" as const, board, ...(fde ? { fdeIsPresales: true } : {}) })),
  ...greenhouse.map(([name, board]) => ({ id: `greenhouse:${board}`, name, ats: "greenhouse" as const, board })),
];
