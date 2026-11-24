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
  assert.ok(ctx.includes("[E-csa] Certified ServiceNow Administrator (CSA)"), ctx);
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
ok("checks: a year followed by a word is not read as a suffix", () => {
  const src: SourceRef = { id: "B-sn-asc-1", text: "Quota attainment: 112% (2025, managing the territory on my own for half the year), 135% (2024), 3x growth, $1.5M pipeline" };
  assert.deepEqual(checkLine({ text: "Quota attainment: 112% (2025), 135% (2024)", sources: [src.id] }, srcMap([src]), ""), []);
  assert.deepEqual(checkLine({ text: "Grew pipeline to $1.5M, 3x growth", sources: [src.id] }, srcMap([src]), ""), []);
  assert.deepEqual(checkLine({ text: "Grew pipeline to $2M", sources: [src.id] }, srcMap([src]), "").map((f) => f.kind), ["number"]);
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
  for (const id of ["E-a", "E-b", "S-story", "B-summary", "B-ach-1"]) assert.ok(ids.includes(id), id);
  for (const r of BASE.roles) for (const b of r.bullets) assert.ok(ids.includes(b.id), b.id);
  assert.equal(list.find((x) => x.id === "E-b")!.useWhen, "AI roles");
  const notes = list.filter((x) => x.id.startsWith("N-"));
  assert.deepEqual(notes.map((n) => n.text), ["a", "b"]);
  assert.equal(new Set(ids).size, ids.length);
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
  { posting: "We need a Solutions Engineer for AI agents. ".repeat(6), sources: [{ id: "E-csa", text: "Certified ServiceNow Administrator (CSA)." }] },
  async (prompt) => {
    seenPrompt = prompt;
    return rawDraft();
  },
);
ok("generateDraft passes sources and posting", () => {
  assert.ok(seenPrompt.includes("[E-csa] Certified ServiceNow Administrator (CSA)."));
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

// ---- Task 5: PDF rendering and one-page fit ----
const pdf = await import("../lib/resume/pdf/render");
type TR = import("../lib/resume/generate").TailoredResume;
const fromBase = (): TR => ({
  tagline: BASE.tagline,
  summary: { text: BASE.summary.text, sources: [BASE.summary.id] },
  roles: BASE.roles.map((r) => ({ roleId: r.id, bullets: r.bullets.map((b, i) => ({ text: b.text, sources: [b.id], priority: i + 1 })) })),
  achievements: BASE.achievements.map((a) => ({ title: a.title, text: a.text, sources: [a.id] })),
  skills: BASE.skills,
  emphasis: "",
  gaps: [],
});

const baseDesigned = await pdf.renderPdf(pdf.toRenderable(fromBase(), BASE), "designed");
const baseAts = await pdf.renderPdf(pdf.toRenderable(fromBase(), BASE), "ats");
ok("base renders to one page", () => {
  assert.equal(pdf.pageCount(baseDesigned), 1);
  assert.ok(pdf.pageCount(baseAts) <= 2); // the current ATS version already spills a few lines to page 2
});

const long = fromBase();
long.roles[0].bullets = Array.from({ length: 12 }, (_, i) => ({
  text: `Built a long and detailed demo environment number ${i} that walks through discovery, integrations, data and the business case for the buyer`,
  sources: ["B-devrev-1"],
  priority: i + 1,
}));
const fitted = await pdf.fitToOnePage(long, BASE);
ok("overlong is trimmed", () => {
  assert.equal(pdf.pageCount(fitted.designed), 1);
  assert.ok((fitted.resume.cut ?? []).length > 0);
  assert.ok(fitted.resume.roles.every((r) => r.bullets.length >= 1));
  assert.ok(fitted.resume.cut!.every((t) => !fitted.resume.roles[0].bullets.some((b) => b.text === t)));
});

const special = fromBase();
special.roles[0].bullets[0] = { text: "R&D <beta> “quotes” – en dash https://example.com/a/very/long/path/that/keeps/going/and/going", sources: ["B-devrev-1"], priority: 1 };
const sp = await pdf.fitToOnePage(special, BASE);
ok("renders special characters", () => {
  assert.equal(sp.designed.subarray(0, 4).toString(), "%PDF");
  assert.equal(sp.ats.subarray(0, 4).toString(), "%PDF");
  assert.equal(pdf.pageCount(sp.designed), 1);
});

// ---- Task 6: drafts, saved files and Blob ----
const store = await import("../lib/resume/store");
const appOwner = { kind: "app", id: "app-1" } as const;
const jobOwner = { kind: "job", key: "ashby:abc" } as const;
await store.saveDraft(jobOwner, fromBase());
const jobRec = await store.getResume(jobOwner);
const emptyRec = await store.getResume(appOwner);
ok("store: draft round trip per owner", () => {
  assert.equal(jobRec.draft!.tagline, BASE.tagline);
  assert.deepEqual(jobRec.saved, []);
  assert.equal(emptyRec.draft, undefined);
});
ok("store: parseOwner", () => {
  assert.deepEqual(store.parseOwner("app:app-1"), appOwner);
  assert.deepEqual(store.parseOwner("job:ashby:abc"), jobOwner);
  assert.equal(store.parseOwner("bad"), null);
  assert.equal(store.ownerString(jobOwner), "job:ashby:abc");
});

await store.moveOwner(jobOwner, appOwner);
const movedApp = await store.getResume(appOwner);
const movedJob = await store.getResume(jobOwner);
await store.moveOwner(jobOwner, appOwner); // second move: no-op
const afterSecond = await store.getResume(appOwner);
ok("moveOwner", () => {
  assert.equal(movedApp.draft!.tagline, BASE.tagline);
  assert.equal(movedJob.draft, undefined);
  assert.equal(afterSecond.draft!.tagline, BASE.tagline); // empty source leaves the target untouched
});

delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.BLOB_STORE_ID;
let notConfigured: unknown;
try {
  await store.savePdfs(appOwner, { designed: Buffer.from("%PDF"), ats: Buffer.from("%PDF"), company: "Rox" });
} catch (e) {
  notConfigured = e;
}
const unchanged = await store.getResume(appOwner);
ok("save without BLOB token", () => {
  assert.ok(notConfigured instanceof store.BlobNotConfigured, String(notConfigured));
  assert.deepEqual(unchanged.saved, []);
});

process.env.BLOB_READ_WRITE_TOKEN = "test-token";
const puts: { path: string; opts: Record<string, unknown> }[] = [];
const saved = await store.savePdfs(
  appOwner,
  { designed: Buffer.from("%PDF-d"), ats: Buffer.from("%PDF-a"), company: "Rox Data Corp" },
  async (path, _body, opts) => {
    puts.push({ path, opts });
    return { url: `https://store.private.blob.vercel-storage.com/${path}-x1`, pathname: `${path}-x1` };
  },
);
const withSaved = await store.getResume(appOwner);
ok("savePdfs records both files", () => {
  const day = new Date().toISOString().slice(0, 10);
  assert.equal(saved.fileBase, `Gavin-Whitlock-Resume-Rox-Data-Corp-${day}`);
  assert.ok(saved.designedUrl.includes(`resumes/${saved.fileBase}.pdf`));
  assert.ok(saved.atsUrl.includes(`resumes/${saved.fileBase}-ATS.pdf`));
  assert.equal(puts[0].opts.access, "private");
  assert.equal(puts[0].opts.addRandomSuffix, true);
  assert.equal(withSaved.saved.length, 1);
  assert.equal(withSaved.draft!.tagline, BASE.tagline);
});
delete process.env.BLOB_READ_WRITE_TOKEN;

// ---- Task 7: editor form ----
const { draftFromForm } = await import("../lib/resume/form");
const prev = fromBase();
prev.emphasis = "Led with AI.";
prev.gaps = ["Go"];
prev.cut = ["old line"];
const f = new FormData();
f.set("tagline", "Solutions Engineer | AI Agents");
f.set("summary.text", "New summary.");
f.set("summary.sources", "B-summary, E-csa");
f.set("role.devrev.0.text", "First DevRev bullet");
f.set("role.devrev.0.sources", "B-devrev-1");
f.set("role.devrev.0.order", "2");
f.set("role.devrev.1.text", "Second DevRev bullet");
f.set("role.devrev.1.sources", "B-devrev-2");
f.set("role.devrev.1.order", "1");
f.set("role.devrev.2.text", "   "); // emptied -> removed
f.set("role.devrev.2.sources", "B-devrev-3");
f.set("role.devrev.new", "A bullet I typed");
f.set("ach.0.title", "Big deal");
f.set("ach.0.text", "Won it.");
f.set("ach.0.sources", "B-ach-1");
f.set("skills.0.group", "AI");
f.set("skills.0.items", "Agents");
f.set("certifications", "");
const edited = draftFromForm(f, prev);
ok("editor form rebuilds the draft", () => {
  assert.equal(edited.tagline, "Solutions Engineer | AI Agents");
  assert.deepEqual(edited.summary, { text: "New summary.", sources: ["B-summary", "E-csa"] });
  const devrev = edited.roles.find((r) => r.roleId === "devrev")!;
  assert.deepEqual(devrev.bullets.map((b) => b.text), ["Second DevRev bullet", "First DevRev bullet", "A bullet I typed"]);
  assert.deepEqual(devrev.bullets[2].sources, []); // typed by hand: flagged "no source"
  assert.deepEqual(devrev.bullets.map((b) => b.priority), [1, 2, 3]);
  assert.equal(edited.roles.length, 5); // roles missing from the form keep their bullets
  assert.equal(edited.roles[1].bullets.length, prev.roles[1].bullets.length);
  assert.deepEqual(edited.achievements, [{ title: "Big deal", text: "Won it.", sources: ["B-ach-1"] }]);
  assert.deepEqual(edited.skills, [{ group: "AI", items: "Agents" }]);
  assert.equal(edited.certifications, undefined);
  assert.equal(edited.emphasis, "Led with AI.");
  assert.deepEqual(edited.gaps, ["Go"]);
  assert.deepEqual(edited.cut, []); // cuts are recomputed on the next render
});

// ---- Final review fixes ----
const checks = await import("../lib/resume/checks");
const { readFileSync, readdirSync, statSync } = await import("node:fs");
const pathMod = await import("node:path");

ok("review: the general resume passes the blocked-terms check", () => {
  assert.deepEqual(checks.resumeBlockedTerms(fromBase()), []);
  assert.deepEqual(blockedTerms("Demos and architecture workshops across Enterprise Architecture"), []);
  assert.deepEqual(blockedTerms("Worked with architects on the design"), ["architect"]);
});

ok("review: the real job title is allowed only outside the tagline and summary", () => {
  assert.deepEqual(blockedTerms("As AI Solution Architect at ServiceNow, led the POC"), []);
  const t = fromBase();
  t.tagline = "Solutions Engineer | AI Solution Architect";
  assert.deepEqual(checks.resumeBlockedTerms(t), ["architect"]);
  const u = fromBase();
  u.summary = { text: "Former AI Solution Architect who builds demos.", sources: ["B-summary"] };
  assert.deepEqual(checks.resumeBlockedTerms(u), ["architect"]);
});

ok("review: skills and certifications must come from his material", () => {
  const srcs: SourceRef[] = [{ id: "E-csa", text: "Certified ServiceNow Administrator (CSA)." }];
  assert.deepEqual(checks.untracedTerms("AI agents, ServiceNow (ITOM, ITSM, SPM), MEDDPICC", srcs, BASE), []);
  assert.deepEqual(checks.untracedTerms("AI agents, Kubernetes; Python", srcs, BASE), ["Kubernetes", "Python"]);
  assert.deepEqual(checks.untracedTerms("Certified ServiceNow Administrator (CSA)", srcs, BASE), []);
  assert.deepEqual(checks.untracedTerms("AWS Certified Solutions Architect", srcs, BASE), ["AWS Certified Solutions Architect"]);
});

ok("review: source ids stay stable when the bank or notes change", () => {
  const bank = [
    { id: "seed-csa", what: "CSA", where: "certification", createdAt: "" },
    { id: "seed-cmdb", what: "CMDB", where: "ServiceNow", createdAt: "" },
    { id: "3f2a9c1e-aaaa-bbbb-cccc-1234567890ab", what: "New", where: "DevRev", createdAt: "" },
  ];
  const a = buildSources({ base: BASE, stories: [{ heading: "Why I did a bootcamp", text: "x" }], bank, notes: "one\n\ntwo" });
  const b = buildSources({ base: BASE, stories: [{ heading: "New story", text: "y" }, { heading: "Why I did a bootcamp", text: "x" }], bank: bank.slice(1), notes: "zero\n\none\n\ntwo" });
  const id = (list: SourceRef[], text: string) => list.find((x) => x.text.endsWith(text))!.id;
  assert.equal(id(a, "CMDB"), "E-cmdb");
  assert.equal(id(a, "CMDB"), id(b, "CMDB"));
  assert.equal(id(a, "New"), "E-3f2a9c1e");
  assert.equal(id(a, "x"), id(b, "x"));
  assert.equal(id(a, "two"), id(b, "two"));
});

const tall = fromBase();
tall.achievements = tall.achievements.map((x) => ({ ...x, text: `${x.text} ${"Long supporting detail about the outcome and the customer. ".repeat(6)}` }));
const tallFit = await pdf.fitToOnePage(tall, BASE);
ok("review: no pointless cuts when the overflow isn't in the experience bullets", () => {
  assert.equal(tallFit.tooLong, true);
  assert.deepEqual(tallFit.resume.cut, []);
  assert.deepEqual(tallFit.resume.roles.map((r) => r.bullets.length), tall.roles.map((r) => r.bullets.length));
});
ok("review: fitToOnePage reports ATS pages", () => {
  assert.ok(tallFit.atsPages >= 1);
  assert.equal(fitted.tooLong, false);
});

const { kimi } = await import("../lib/model");
process.env.MOONSHOT_API_KEY ??= "test-key";
ok("review: tailoring's model call stops before Vercel's 60-second limit", () => {
  const m = kimi(undefined, { timeoutMs: 45_000, maxRetries: 0 }) as unknown as { timeout?: number; caller?: { maxRetries?: number } };
  assert.equal(m.timeout, 45_000);
  assert.equal(m.caller?.maxRetries, 0);
  assert.equal(gen.TAILOR_MODEL.timeoutMs < 60_000 - 5_000, true);
});

ok("review: every admin page checks the login itself", () => {
  const root = "app/admin/(app)";
  const pages: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = pathMod.join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n === "page.tsx") pages.push(p);
    }
  };
  walk(root);
  const missing = pages.filter((p) => !/await requireAdmin\(\)/.test(readFileSync(p, "utf8")));
  assert.deepEqual(missing, []);
});

// ---- Delete saved PDFs and discard drafts ----
const delOwner = { kind: "app", id: "app-del" } as const;
process.env.BLOB_READ_WRITE_TOKEN = "test-token";
const fakePut: import("../lib/resume/store").BlobPut = async (path) => ({ url: `https://s.private.blob.vercel-storage.com/${path}`, pathname: path });
await store.saveDraft(delOwner, fromBase());
const keep = await store.savePdfs(delOwner, { designed: Buffer.from("d1"), ats: Buffer.from("a1"), company: "Keep" }, fakePut);
const drop = await store.savePdfs(delOwner, { designed: Buffer.from("d2"), ats: Buffer.from("a2"), company: "Drop" }, fakePut);
const deleted: string[][] = [];
await store.deleteSaved(delOwner, drop.id, async (urls) => {
  deleted.push(urls);
});
const afterDelete = await store.getResume(delOwner);
ok("delete: removes both files from Blob and the row from the list", () => {
  assert.deepEqual(deleted, [[drop.designedUrl, drop.atsUrl]]);
  assert.deepEqual(afterDelete.saved.map((x) => x.fileBase), [keep.fileBase]);
  assert.ok(afterDelete.draft); // the draft is untouched
});

let missing: unknown;
try {
  await store.deleteSaved(delOwner, "no-such-file", async () => {});
} catch (e) {
  missing = e;
}
ok("delete: an unknown file changes nothing", () => {
  assert.equal(missing, undefined);
});

await store.deleteSaved(delOwner, keep.id, async () => {
  throw Object.assign(new Error("The requested blob does not exist"), { name: "BlobNotFoundError" });
});
const afterGone = await store.getResume(delOwner);
ok("delete: a file already gone from Blob still leaves the list", () => assert.deepEqual(afterGone.saved, []));

const keepRow = await store.savePdfs(delOwner, { designed: Buffer.from("d3"), ats: Buffer.from("a3"), company: "Keep" }, fakePut);
let blobDown: unknown;
try {
  await store.deleteSaved(delOwner, keepRow.id, async () => {
    throw new Error("Blob service unavailable");
  });
} catch (e) {
  blobDown = e;
}
const afterFail = await store.getResume(delOwner);
ok("delete: a Blob failure keeps the row so it can be retried", () => {
  assert.ok(blobDown instanceof Error);
  assert.deepEqual(afterFail.saved.map((x) => x.fileBase), [keepRow.fileBase]);
});

await store.discardDraft(delOwner);
const afterDiscard = await store.getResume(delOwner);
ok("discard: clears the draft, keeps saved PDFs", () => {
  assert.equal(afterDiscard.draft, undefined);
  assert.equal(afterDiscard.saved.length, 1);
});
const lone = { kind: "job", key: "lone" } as const;
await store.saveDraft(lone, fromBase());
await store.discardDraft(lone);
const loneRec = await store.getResume(lone);
ok("discard: empty record afterwards", () => assert.deepEqual(loneRec, { saved: [] }));
delete process.env.BLOB_READ_WRITE_TOKEN;

console.log("\nAll resume tests passed.");
