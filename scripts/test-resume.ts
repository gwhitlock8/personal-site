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

console.log("\nAll resume tests passed.");
