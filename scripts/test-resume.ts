// Offline tests for tailored resumes: base data, Experience bank, sources and
// truth checks, draft merging, PDF rendering and storage.
//   npm test

import assert from "node:assert/strict";
import { BASE } from "../lib/resume/base";

function ok(name: string, fn: () => void) {
  fn();
  console.log(`ok  ${name}`);
}

// ---- Task 1: base resume ----
ok("base: ids unique", () => {
  const ids = [BASE.summary.id, ...BASE.roles.flatMap((r) => r.bullets.map((b) => b.id)), ...BASE.achievements.map((a) => a.id)];
  assert.equal(new Set(ids).size, ids.length);
});
ok("base: five roles in order", () => assert.deepEqual(BASE.roles.map((r) => r.id), ["devrev", "sn-ai", "sn-asc", "lm-se", "lm-csm"]));
ok("base: no phone, no AmEx", () => assert.ok(!/american express|\bamex\b|\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/i.test(JSON.stringify(BASE))));
ok("base: tagline", () => assert.equal(BASE.tagline, "Solutions Engineer | AI Solutions"));

// ---- Task 2: Experience bank ----
process.env.ADMIN_STORE = "memory";
const exp = await import("../lib/admin/experience");
const first = await exp.listExperience();
const second = await exp.listExperience();
ok("experience: seeds six entries once", () => {
  assert.equal(first.length, 6);
  assert.deepEqual(second.map((e) => e.id), first.map((e) => e.id));
});
await exp.addExperience({ what: "Built a Postman collection for the API", where: "DevRev" });
const afterAdd = await exp.listExperience();
ok("experience: add then list", () => {
  assert.equal(afterAdd.length, 7);
  assert.equal(afterAdd[6].what, "Built a Postman collection for the API");
});
ok("experience: context lines", () => {
  const ctx = exp.experienceAsContext(afterAdd);
  assert.ok(ctx.includes("[E1] Certified ServiceNow Administrator (CSA)"), ctx);
  assert.ok(ctx.includes("use when: ServiceNow-heavy roles"), ctx);
});

// ---- Task 3: sources and truth checks ----
const { buildSources } = await import("../lib/resume/sources");
const { checkLine, blockedTerms } = await import("../lib/resume/checks");
type SourceRef = import("../lib/resume/sources").SourceRef;
const srcMap = (list: SourceRef[]) => new Map(list.map((x) => [x.id, x]));
const quota: SourceRef = { id: "B-sn-asc-1", text: "Quota attainment: 112% (2025), 135% (2024)" };

ok("checks: unknown and missing sources", () => {
  assert.deepEqual(checkLine({ text: "x", sources: [] }, new Map(), "").map((f) => f.kind), ["no-source"]);
  assert.deepEqual(checkLine({ text: "x", sources: ["E99"] }, new Map(), "").map((f) => f.kind), ["unknown-source"]);
});
ok("checks: numbers must appear in sources", () => {
  assert.deepEqual(checkLine({ text: "Hit 135% of quota", sources: [quota.id] }, srcMap([quota]), ""), []);
  assert.deepEqual(checkLine({ text: "Hit 140% of quota", sources: [quota.id] }, srcMap([quota]), "").map((f) => f.kind), ["number"]);
  const deal: SourceRef = { id: "B-lm-se-1", text: "Closed $150K+ in new business" };
  assert.deepEqual(checkLine({ text: "Closed $150K+ while ramping", sources: [deal.id] }, srcMap([deal]), ""), []);
});
ok("copy check ignores short overlaps and punctuation", () => {
  const s1: SourceRef = { id: "S1", text: "Runs discovery and builds demos; owns the technical win with account executives" };
  const posting = "You will run discovery, build demos. You'll OWN the technical win, with Account Executives, across the region.";
  assert.deepEqual(checkLine({ text: "Run discovery and build demos", sources: ["S1"] }, srcMap([s1]), posting), []);
  assert.deepEqual(checkLine({ text: "Owned the technical win with account executives across the region", sources: ["S1"] }, srcMap([s1]), posting).map((f) => f.kind), ["copied"]);
});
ok("blocked terms", () => {
  assert.deepEqual(blockedTerms("Won the AmEx deal"), ["AmEx"]);
  assert.deepEqual(blockedTerms("Solutions architect for AI"), ["architect"]);
  assert.deepEqual(blockedTerms("AI Solution Architect at ServiceNow"), []);
  assert.deepEqual(blockedTerms("Call 512-555-0100"), ["phone number"]);
  assert.deepEqual(blockedTerms("American Express"), ["American Express"]);
});
ok("checks: blocked terms flagged on a line", () => {
  assert.ok(checkLine({ text: "Won the AmEx deal", sources: [quota.id] }, srcMap([quota]), "").some((f) => f.kind === "blocked"));
});
ok("sources: ids and notes", () => {
  const list = buildSources({
    base: BASE,
    stories: [{ heading: "Story", text: "A story" }],
    bank: [
      { id: "a", what: "One", where: "DevRev", createdAt: "" },
      { id: "b", what: "Two", where: "general", useWhen: "AI roles", createdAt: "" },
    ],
    notes: "a\n\nb",
  });
  const ids = list.map((x) => x.id);
  for (const id of ["E1", "E2", "N1", "N2", "S1", "B-summary", "B-ach-1"]) assert.ok(ids.includes(id), id);
  for (const r of BASE.roles) for (const b of r.bullets) assert.ok(ids.includes(b.id), b.id);
  assert.equal(list.find((x) => x.id === "E2")!.useWhen, "AI roles");
  assert.equal(list.find((x) => x.id === "N2")!.text, "b");
});

// ---- Task 4: draft generation ----
const gen = await import("../lib/resume/generate");
const { RateLimited } = await import("../lib/admin/ingest");
const repo = await import("../lib/admin/repo");
const { adminDb } = await import("../lib/admin/db");
const rawDraft = (over: Record<string, unknown> = {}) => ({
  tagline: "Presales AI",
  summary: { text: "Solutions engineer who builds AI demos.", sources: ["B-summary"] },
  roles: [
    { roleId: "devrev", bullets: [{ text: "Built Teams and Slack integrations", sources: ["B-devrev-3"], priority: 1 }] },
    { roleId: "foo", bullets: [{ text: "Invented role", sources: [], priority: 1 }] },
    { roleId: "sn-asc", bullets: [] },
  ],
  achievements: [{ title: "Eight-figure AI deal", text: "Led the POC.", sources: ["B-ach-1"] }],
  skills: [{ group: "AI", items: "AI agents" }],
  certifications: "",
  emphasis: "Led with AI demos.",
  gaps: ["Go"],
  ...over,
});

ok("mergeDraft fills missing roles", () => {
  const t = gen.mergeDraft(rawDraft(), BASE);
  assert.deepEqual(t.roles.map((r) => r.roleId), ["devrev", "sn-ai", "sn-asc", "lm-se", "lm-csm"]);
  assert.deepEqual(t.roles.find((r) => r.roleId === "sn-ai")!.bullets.map((b) => b.sources), [["B-sn-ai-1"]]);
  assert.deepEqual(t.roles.find((r) => r.roleId === "sn-asc")!.bullets[0].sources, ["B-sn-asc-1"]); // empty -> fallback
  assert.equal(t.roles.find((r) => r.roleId === "devrev")!.bullets[0].text, "Built Teams and Slack integrations");
  assert.equal(t.certifications, undefined);
});
ok("mergeDraft forces tagline", () => {
  assert.equal(gen.mergeDraft(rawDraft(), BASE).tagline, "Solutions Engineer | Presales AI");
  assert.equal(gen.mergeDraft(rawDraft({ tagline: "Solutions Engineer | Presales AI" }), BASE).tagline, "Solutions Engineer | Presales AI");
  const arch = gen.mergeDraft(rawDraft({ tagline: "AI Architect" }), BASE).tagline;
  assert.equal(arch, "Solutions Engineer | AI Architect");
  assert.deepEqual(blockedTerms(arch), ["architect"]);
});

ok("mergeDraft caps bullets at five per role", () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ text: `Bullet ${i}`, sources: ["B-devrev-1"], priority: i + 1 }));
  const t = gen.mergeDraft(rawDraft({ roles: [{ roleId: "devrev", bullets: many }] }), BASE);
  assert.equal(t.roles[0].bullets.length, 5);
  assert.equal(t.roles[0].bullets[4].text, "Bullet 4");
});

let seenPrompt = "";
const drafted = await gen.generateDraft(
  { posting: "We need a Solutions Engineer for AI agents. ".repeat(6), sources: [{ id: "E1", text: "Certified ServiceNow Administrator (CSA)." }] },
  async (prompt) => {
    seenPrompt = prompt;
    return rawDraft();
  },
);
ok("generateDraft passes sources and posting", () => {
  assert.ok(seenPrompt.includes("[E1] Certified ServiceNow Administrator (CSA)."));
  assert.ok(seenPrompt.includes("We need a Solutions Engineer for AI agents."));
  assert.equal(drafted.roles.length, 5);
});

process.env.ADMIN_MODEL_RPM = "1";
await adminDb().del(`model-budget:${Math.floor(Date.now() / 60_000)}`);
await repo.takeModelBudget();
let limited: unknown;
try {
  await gen.generateDraft({ posting: "x".repeat(300), sources: [] }, async () => rawDraft());
} catch (e) {
  limited = e;
}
ok("budget exhausted leaves draft", () => assert.ok(limited instanceof RateLimited, String(limited)));
process.env.ADMIN_MODEL_RPM = "1000";

console.log("\nAll resume tests passed.");
