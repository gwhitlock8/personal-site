// Ask the real assistant from your terminal (uses MOONSHOT_API_KEY from .env.local):
//   npm run ask -- "What did Gavin do at ServiceNow?"
// Prints the retrieved sources, then streams Kimi K3's answer.

import { runChat } from "../lib/chains";

const question = process.argv.slice(2).join(" ") || "Give me a quick overview of Gavin.";
const started = Date.now();
const { stream, sources } = await runChat({ history: [], question });

console.log("Sources:", sources.map((s) => `${s.source}/${s.section}`).join(" | "), "\n");
for await (const chunk of stream) process.stdout.write(chunk);
console.log(`\n\n(${((Date.now() - started) / 1000).toFixed(1)}s)`);
