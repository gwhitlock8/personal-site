// Offline tests: no API key needed.
//   npm test
// 1. Retrieval returns the right sections for sample questions.
// 2. The chat and fit chains send a request Kimi K3 will accept,
//    checked against a fake OpenAI-compatible server on localhost.

import http from "node:http";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { loadKnowledge } from "../lib/knowledge";
import { BM25Retriever } from "../lib/retriever";

const docs = await loadKnowledge();
console.log(`Loaded ${docs.length} chunks from ${new Set(docs.map((d) => d.metadata.source)).size} sources`);

const retriever = new BM25Retriever({ docs, k: 3 });
const cases: [string, string][] = [
  ["What was his quota attainment at ServiceNow?", "experience"],
  ["How did Gavin build this assistant?", "this-site"],
  ["Does he know AWS or Kubernetes?", "skills"],
  ["Why no embeddings or vector database?", "this-site"],
  ["Has he worked on payments?", "skills"],
  ["customer success renewals churn", "experience"],
  ["What AI prototypes has Gavin built for customers?", "career-notes/An AI prototype"],
  ["Has he deployed to GCP with Terraform?", "career-notes/Getting ServiceNow to deploy into GCP"],
  ["What's the biggest deal he's helped win?", "career-notes/His biggest deal"],
  ["Has he built integrations with Teams and Slack?", "career-notes/Integrations with Microsoft Teams and Slack"],
  ["Why did he go to Flatiron?", "career-notes/Why he went to a coding bootcamp"],
  ["Does he still code?", "career-notes/How he uses his coding skills now"],
  ["How does he run discovery calls?", "career-notes/How he runs discovery"],
  ["Does he use MEDDPICC or a demo methodology?", "career-notes/How he runs discovery"],
];
for (const [q, expected] of cases) {
  const top = await retriever.invoke(q);
  const got = top.map((d) => `${d.metadata.source}/${d.metadata.section}`);
  assert.ok(got.some((g) => g.startsWith(expected)), `"${q}" expected ${expected}, got ${got.join(", ")}`);
  console.log(`ok  ${q}\n    -> ${got.join(" | ")}`);
}

// ---- Fake Moonshot server ----
const requests: any[] = [];
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw);
    requests.push({ path: req.url, auth: req.headers.authorization, body });
    if (body.stream) {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      const send = (delta: object) =>
        res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`);
      send({ role: "assistant", reasoning_content: "thinking..." });
      send({ content: "Gavin hit " });
      send({ content: "135% in 2024." });
      res.end("data: [DONE]\n\n");
    } else {
      const fit = { summary: "Good fit.", matches: [{ requirement: "Presales", evidence: "ServiceNow" }], gaps: [] };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: body.model, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", reasoning_content: "hmm", content: JSON.stringify(fit) } }] }));
    }
  });
});
await new Promise<void>((r) => server.listen(0, r));
process.env.MOONSHOT_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
process.env.MOONSHOT_API_KEY = "test-key";

const { runChat, runFit } = await import("../lib/chains");

const { stream, sources } = await runChat({
  history: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello!" }],
  question: "What was his quota at ServiceNow?",
  persona: "recruiter",
});
let answer = "";
for await (const chunk of stream) answer += chunk;
assert.equal(answer, "Gavin hit 135% in 2024.", "reasoning_content must not leak into the answer");
assert.ok(sources.length > 0);

const chatReq = requests[0];
assert.equal(chatReq.path, "/v1/chat/completions");
assert.equal(chatReq.auth, "Bearer test-key");
assert.equal(chatReq.body.model, "kimi-k3");
assert.equal(chatReq.body.reasoning_effort, "low");
for (const banned of ["temperature", "top_p", "n", "presence_penalty", "frequency_penalty"]) {
  assert.ok(!(banned in chatReq.body), `request must omit ${banned} for K3`);
}
const roles = chatReq.body.messages.map((m: any) => m.role);
assert.deepEqual(roles, ["system", "user", "assistant", "user"]);
assert.match(chatReq.body.messages[0].content, /recruiter/);
console.log("ok  chat request shape:", Object.keys(chatReq.body).join(", "));

const { fit } = await runFit("We need a solutions engineer with presales experience. ".repeat(10));
assert.equal(fit.summary, "Good fit.");
const fitReq = requests[1];
assert.equal(fitReq.body.response_format?.type, "json_schema");
assert.ok(!("temperature" in fitReq.body));
console.log("ok  fit request uses response_format json_schema, parsed:", JSON.stringify(fit));

server.close();
console.log("\nAll tests passed.");
