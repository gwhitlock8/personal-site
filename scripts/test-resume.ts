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

console.log("\nAll resume tests passed.");
