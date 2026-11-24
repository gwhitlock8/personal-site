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

console.log("\nAll resume tests passed.");
