// Offline tests for Job Matches: search criteria, source parsers (shapes taken
// from the live Ashby, Greenhouse, Lever, Hacker News and Notion responses),
// the daily scan, Fit Checks under the model budget, and the Digest section.
//   npm test

import assert from "node:assert/strict";
import { fitScore, htmlToText, parseBoardInput, locationQualifies, normalizeUrl, postingQualifies, titleQualifies, titleTerritoryElsewhere, type Posting, type WatchlistCompany } from "../lib/admin/jobs";
import { parseAshby, parseGreenhouse, parseHnComment, parseLever, parseNotionBoard } from "../lib/admin/job-sources";

function ok(name: string, fn: () => void) {
  fn();
  console.log(`ok  ${name}`);
}

// ---- Titles ----
ok("titles: SE-type roles in, managers/juniors/post-sales out", () => {
  const yes = ["Solutions Engineer", "Senior Sales Engineer", "Enterprise Solutions Consultant", "Presales Solutions Engineer, GRC", "Senior Solutions Consultant (SaaS - Pre-Sales)", "Agent Engineer, Pre-sales", "Sr. Sales Engineer (Forward Deployed Engineer - Pre Sales)", "Staff Solutions Engineer - Central"];
  const no = ["Manager, Solutions Engineering", "Head of Solutions Engineering", "Associate Solutions Engineer", "Solutions Engineer Intern", "Solutions Engineer, Post-Sales", "Implementation Consultant", "Account Executive", "Software Engineer", "Resident Solutions Architect", "Director, Sales Engineering"];
  for (const t of yes) assert.ok(titleQualifies(t, ""), t);
  for (const t of no) assert.ok(!titleQualifies(t, "presales"), t);
});

ok("titles: Solutions Architect and FDE only when the posting says presales", () => {
  assert.ok(!titleQualifies("Solutions Architect", "Partner with Account Executives on deployments"));
  assert.ok(titleQualifies("Solutions Architect", "You'll be the pre-sales technical lead"));
  assert.ok(!titleQualifies("Forward Deployed Engineer", "Deploy our product inside customer environments"));
  assert.ok(titleQualifies("Forward Deployed Engineer", "A presales role working with our sales team"));
  assert.ok(titleQualifies("Forward Deployed Engineer", "Deploy agents", { fdeIsPresales: true })); // LangChain
  assert.ok(titleQualifies("Applied AI Architect", "Lead pre-sales technical engagements"));
});

// ---- Locations ----
ok("locations: Austin or US remote, not another territory", () => {
  const cases: [string[], boolean, boolean][] = [
    [["Austin", "Texas", "United States"], false, true],
    [["Remote- US"], true, true],
    [["Remote - United States (East Coast preferred)"], true, true],
    [["Remote within US Eastern or Central time zones; Philadelphia, PA also available"], true, true],
    [["Remote — continental United States, or San Francisco, CA"], true, true],
    [["Remote - TOLA region, US"], true, true],
    [["Texas", "United States"], true, true],
    [["Remote, AMER"], true, true],
    [["United States — remote or hybrid; Denver preferred"], false, true],
    [["San Francisco, CA"], false, false],
    [["Remote - Southeast United States"], true, false],
    [["Remote - South Florida; Palm Beach, Broward or Dade preferred"], true, false],
    [["Remote - Boston, MA or Chicago, IL metro areas"], true, false],
    [["Chicago area; remote-first with monthly NYC office visits"], false, false],
    [["Remote — US East Coast"], true, false],
    [["Chicago", "United States"], true, false],
    [["Remote - London"], true, false],
    [["Colombia", "Colombia"], true, false],
  ];
  for (const [locs, remote, want] of cases) assert.equal(locationQualifies(locs, remote), want, locs.join(" / "));
});

ok("territory in the title", () => {
  assert.ok(titleTerritoryElsewhere("Enterprise Solutions Engineer, East"));
  assert.ok(titleTerritoryElsewhere("Enterprise Solution Engineer - South East"));
  assert.ok(!titleTerritoryElsewhere("Enterprise Solutions Engineer, Texas"));
  assert.ok(!titleTerritoryElsewhere("Solutions Engineer, Enterprise, Central"));
  assert.ok(!titleTerritoryElsewhere("Senior Solutions Engineer"));
  const p: Posting = { key: "k", source: "greenhouse", company: "Glean", title: "Enterprise Solutions Engineer, East", locations: ["Remote - US"], remote: true, url: "u", description: "" };
  assert.ok(!postingQualifies(p));
  assert.ok(postingQualifies({ ...p, title: "Enterprise Solutions Engineer, Texas" }));
});

ok("helpers", () => {
  assert.equal(normalizeUrl("https://www.jobs.ashbyhq.com/rox/abc/"), "jobs.ashbyhq.com/rox/abc");
  assert.equal(htmlToText("Acme | SE | Remote (US)<p>We&#x27;re hiring &amp; growing"), "Acme | SE | Remote (US)\nWe're hiring & growing");
  assert.equal(htmlToText("&lt;p&gt;Hello&lt;/p&gt;&lt;ul&gt;&lt;li&gt;One&lt;/li&gt;&lt;/ul&gt;"), "Hello\n- One");
  assert.equal(fitScore({ summary: "", matches: [{ requirement: "a", evidence: "" }, { requirement: "b", evidence: "" }, { requirement: "c", evidence: "" }], gaps: [{ requirement: "d", note: "" }] }), 75);
});

ok("Watchlist: board from a pasted URL or name", () => {
  assert.deepEqual(parseBoardInput("https://jobs.ashbyhq.com/Rox-Data-Corp/abc?x=1"), { ats: "ashby", board: "Rox-Data-Corp" });
  assert.deepEqual(parseBoardInput("job-boards.greenhouse.io/anthropic"), { ats: "greenhouse", board: "anthropic" });
  assert.deepEqual(parseBoardInput("https://boards.greenhouse.io/gleanwork/jobs/1"), { ats: "greenhouse", board: "gleanwork" });
  assert.deepEqual(parseBoardInput("https://jobs.lever.co/acme"), { ats: "lever", board: "acme" });
  assert.deepEqual(parseBoardInput("langchain", "ashby"), { ats: "ashby", board: "langchain" });
  assert.equal(parseBoardInput("https://careers.acme.com/jobs"), null);
  assert.equal(parseBoardInput("langchain"), null);
  assert.equal(parseBoardInput("bad name", "ashby"), null);
});

// ---- Parsers ----
const co = (ats: WatchlistCompany["ats"], board: string, name = board): WatchlistCompany => ({ id: `${ats}:${board}`, name, ats, board });

ok("Ashby: hybrid is not remote; state and country kept", () => {
  const data = { jobs: [
    { id: "a1", title: "Solutions Engineer", location: "San Francisco", isRemote: true, workplaceType: "Hybrid", isListed: true, address: { postalAddress: { addressRegion: "California", addressCountry: "United States" } }, descriptionPlain: "x", jobUrl: "https://jobs.ashbyhq.com/vapi/a1", publishedAt: "2026-11-20" },
    { id: "a2", title: "Senior Solution Engineer", location: "Texas", isRemote: true, workplaceType: "Remote", address: { postalAddress: { addressCountry: "United States" } }, descriptionHtml: "<p>Hi</p>" },
    { id: "a3", title: "Hidden", location: "Remote", isListed: false },
  ] };
  const ps = parseAshby(data, co("ashby", "vapi", "Vapi"));
  assert.equal(ps.length, 2);
  assert.deepEqual([ps[0].remote, ps[0].locations], [false, ["San Francisco", "California", "United States"]]);
  assert.equal(ps[1].url, "https://jobs.ashbyhq.com/vapi/a2");
  assert.equal(ps[1].description, "Hi");
  assert.ok(!postingQualifies(ps[0]) && postingQualifies(ps[1]));
});

ok("Greenhouse: uses the job's location, not company offices", () => {
  const data = { jobs: [{ id: 7, title: "Customer Solutions Architect (Denver)", location: { name: "Denver, Colorado, United States, AMER" }, offices: [{ name: "USA - Austin (dbt)" }], absolute_url: "https://job-boards.greenhouse.io/fivetran/jobs/7", content: "&lt;p&gt;Pre-sales role&lt;/p&gt;" }] };
  const [p] = parseGreenhouse(data, co("greenhouse", "fivetran", "Fivetran"));
  assert.deepEqual(p.locations, ["Denver, Colorado, United States, AMER"]);
  assert.equal(p.key, "greenhouse:fivetran:7");
  assert.equal(p.description, "Pre-sales role");
  assert.ok(!postingQualifies(p));
});

ok("Lever", () => {
  const data = [{ id: "l1", text: "Sales Engineer", hostedUrl: "https://jobs.lever.co/x/l1", createdAt: 1795450978622, workplaceType: "remote", categories: { location: "United States" }, descriptionPlain: "About", lists: [{ text: "You'll", content: "<li>Demo</li>" }] }];
  const [p] = parseLever(data, co("lever", "x", "X"));
  assert.ok(p.remote && postingQualifies(p));
  assert.ok(p.description.includes("- Demo"));
});

ok("Hacker News comment", () => {
  const p = parseHnComment({ id: 123, text: "Estuary | US-Based / Remote | Full-time – https:&#x2F;&#x2F;estuary.dev&#x2F;<p>We're hiring a Senior Solutions Engineer to run demos.", created_at: "2026-11-02T17:00:00Z" })!;
  assert.equal(p.company, "Estuary");
  assert.equal(p.title, "Senior Solutions Engineer");
  assert.equal(p.locations[0], "Estuary | US-Based / Remote | Full-time – https://estuary.dev/");
  assert.ok(postingQualifies(p));
  assert.equal(parseHnComment({ id: 124, text: "Acme | Backend Engineer | Remote" }), null);
});

ok("Notion board: PreSales, active, experienced, US rows only", () => {
  const prop = (s: string) => [[s]];
  const row = (id: string, over: Record<string, unknown[]>) => ({ value: { value: { id, created_time: 1795450978622, properties: { title: prop("Sales Engineer"), "}}Kh": prop("DefensX"), "yx\\G": prop("PreSales (SE/SC/SA)"), rSmt: prop("Active"), "L^gI": prop("Individual Contributor (Experienced)"), "O:Wy": prop("United States"), "^bkc": prop("Remote- US"), "pg[C": prop("Remote"), "l<rc": prop("https://www.linkedin.com/jobs/view/1/"), NciO: [["‣", [["d", { type: "date", start_date: "2026-11-23" }]]]], ...over } } } });
  const data = {
    result: { reducerResults: { collection_group_results: { blockIds: ["r1", "r2", "r3", "r4"] } } },
    recordMap: {
      collection: { c: { value: { value: { schema: { title: { name: "Role Title" }, "}}Kh": { name: "Company" }, "yx\\G": { name: "Role Function" }, rSmt: { name: "Job Status" }, "L^gI": { name: "Role Type" }, "O:Wy": { name: "Region" }, "^bkc": { name: "Role Location (Remote or City)" }, "pg[C": { name: "Location Type" }, "l<rc": { name: "Job Posting URL" }, NciO: { name: "Date Posted" } } } } } },
      block: { r1: row("r1", {}), r2: row("r2", { "L^gI": prop("Individual Contributor (Entry-Level)") }), r3: row("r3", { "O:Wy": prop("Europe") }), r4: row("r4", { "yx\\G": prop("Sales (AE/AM)") }) },
    },
  };
  const ps = parseNotionBoard(data);
  assert.equal(ps.length, 1);
  assert.deepEqual([ps[0].company, ps[0].title, ps[0].postedAt, ps[0].remote], ["DefensX", "Sales Engineer", "2026-11-23", true]);
  assert.ok(postingQualifies({ ...ps[0], title: "Solutions Architect" })); // listed under PreSales counts as saying presales
});

// ---- Scan, dedupe, already applied, closed roles, failing sources ----
process.env.ADMIN_STORE = "memory";
process.env.ADMIN_MODEL_RPM = "1000";
const scan = await import("../lib/admin/job-scan");
const repo = await import("../lib/admin/repo");
const { adminDb } = await import("../lib/admin/db");
const { RateLimited } = await import("../lib/admin/ingest");

const longJd = "We need a solutions engineer who runs discovery, builds demos and owns the technical win. ".repeat(5);
const post = (key: string, over: Partial<Posting> = {}): Posting => ({ key, source: "ashby", company: "Rox", title: "Solutions Engineer", locations: ["Austin"], remote: false, url: `https://jobs.ashbyhq.com/rox/${key}`, description: longJd, watchlistId: "ashby:Rox-Data-Corp", ...over });

await scan.saveWatchlist([{ id: "ashby:Rox-Data-Corp", name: "Rox", ats: "ashby", board: "Rox-Data-Corp" }, { id: "greenhouse:broken", name: "Broken", ats: "greenhouse", board: "broken" }]);
const nowIso = new Date().toISOString();
await repo.saveItem({ id: "app1", kind: "application", company: "Hex", role: "Sales Engineer, Enterprise", stage: "Applied", appliedOn: "2026-11-20", source: "manual", createdAt: nowIso, updatedAt: nowIso, lastEventAt: nowIso });

let boardCalls = 0;
const fetchers1: import("../lib/admin/job-scan").Fetchers = {
  board: async (c) => {
    boardCalls++;
    if (c.board === "broken") throw new Error("404 from boards-api.greenhouse.io");
    return [post("ashby:1"), post("ashby:2", { title: "Account Executive" }), post("ashby:3", { title: "Solutions Engineer (SF)", locations: ["San Francisco"] }), post("ashby:4", { company: "Rox", title: "Solutions Engineer II" })];
  },
  hn: async () => [post("hn:9", { source: "hn", company: "Hex", title: "Sales Engineer, Enterprise", url: "https://news.ycombinator.com/item?id=9", locations: ["Hex | Remote (US)"], remote: true, watchlistId: undefined })],
  // The same Rox posting via the Aggregator: de-duplicated by URL.
  notion: async () => [post("notion:r1", { source: "notion", url: "https://jobs.ashbyhq.com/rox/ashby:1/", watchlistId: undefined })],
};
const r1 = await scan.jobTick({ fetchers: fetchers1, fit: async () => { throw new Error("no fits yet"); }, maxFits: 0 });
const jobs1 = await scan.listJobs();

ok("scan: filters, de-duplicates, records already-applied, reports failures", () => {
  assert.ok(r1.scanned);
  assert.deepEqual(jobs1.map((j) => j.key).sort(), ["ashby:1", "ashby:4", "hn:9"]);
  assert.equal(r1.report!.newMatches, 2);
  assert.equal(jobs1.find((j) => j.key === "hn:9")!.status, "applied");
  assert.equal(jobs1.find((j) => j.key === "hn:9")!.applicationId, "app1");
  const broken = r1.report!.sources.find((s) => s.name === "Broken")!;
  assert.ok(!broken.ok && broken.error!.includes("404"));
  assert.deepEqual(r1.report!.sources.find((s) => s.name === "Rox"), { name: "Rox", ok: true, postings: 4, matches: 2 });
});

// A second tick within 20 hours doesn't scan again.
const r2 = await scan.jobTick({ fetchers: fetchers1, fit: async () => ({ fit: { summary: "", matches: [], gaps: [] } }), maxFits: 0 });
ok("tick: scans at most once a day", () => {
  assert.ok(!r2.scanned);
  assert.equal(boardCalls, 2);
});

// Next day: ashby:4 is gone from the board -> closed; nothing else changes.
const fetchers2 = { ...fetchers1, board: async (c: WatchlistCompany) => (c.board === "broken" ? Promise.reject(new Error("still down")) : [post("ashby:1")]) };
const tomorrow = new Date(Date.now() + 21 * 3_600_000);
const r3 = await scan.jobTick({ fetchers: fetchers2, now: tomorrow, fit: async () => ({ fit: { summary: "", matches: [], gaps: [] } }), maxFits: 0 });
const closed = await scan.getJob("ashby:4");
ok("scan: a role that left its board is closed; repeats are not new", () => {
  assert.ok(r3.scanned);
  assert.equal(r3.report!.newMatches, 0);
  assert.ok(closed!.closedAt);
  assert.ok(!scan.needsFit(closed!));
});

// ---- Fit Checks ----
await scan.saveJob({ ...(await scan.getJob("ashby:1"))!, key: "short", url: "https://x/short", description: "Too short", firstSeen: new Date().toISOString() });
let fitCalls = 0;
const fakeFit = async (jd: string) => {
  fitCalls++;
  assert.ok(jd.startsWith("Solutions Engineer at Rox"));
  return { fit: { summary: "Good fit.", matches: [{ requirement: "Demos", evidence: "e" }, { requirement: "Discovery", evidence: "e" }], gaps: [{ requirement: "Go", note: "n" }] } };
};
const t1 = await scan.jobTick({ fit: fakeFit, maxFits: 5 });
const fitted = await scan.getJob("ashby:1");
const short = await scan.getJob("short");
ok("Fit Check: scored, short postings skipped without a model call", () => {
  assert.equal(t1.fitChecked, 2); // ashby:1 checked, "short" skipped (counted as handled)
  assert.equal(fitCalls, 1);
  assert.equal(fitted!.fitScore, 67);
  assert.ok(fitted!.fitCheckedAt);
  assert.ok(short!.fitSkipped && !short!.fit);
  assert.equal(t1.fitPending, 0);
});

// Budget used up -> stops early, the job waits.
await scan.saveJob({ ...(await scan.getJob("ashby:1"))!, key: "wait", url: "https://x/wait", fit: undefined, fitScore: undefined, fitCheckedAt: undefined });
process.env.ADMIN_MODEL_RPM = "1";
await adminDb().del(`model-budget:${Math.floor(Date.now() / 60_000)}`);
await repo.takeModelBudget(); // use this minute's only call
const t2 = await scan.jobTick({ fit: fakeFit, maxFits: 5 });
ok("Fit Check: waits when the model budget is used", () => {
  assert.equal(t2.stoppedBy, "rate-limit");
  assert.equal(t2.fitChecked, 0);
  assert.equal(t2.fitPending, 1);
});
process.env.ADMIN_MODEL_RPM = "1000";
let rl: unknown;
try { await scan.fitJob((await scan.getJob("wait"))!, async () => { throw Object.assign(new Error("429"), { status: 429 }); }); } catch (e) { rl = e; }
ok("Fit Check: Moonshot 429 becomes RateLimited", () => assert.ok(rl instanceof RateLimited));

// ---- Digest ----
const { buildDigest, newJobMatches } = await import("../lib/admin/digest");
const base: import("../lib/admin/jobs").JobMatch = { key: "d1", source: "ashby", company: "Hex", title: "Sales Engineer", location: "Remote - US", locations: ["Remote - US"], url: "https://jobs.ashbyhq.com/hex/1", description: "", firstSeen: "2026-11-23T20:00:00Z", lastSeen: "2026-11-23T20:00:00Z", status: "new", fitScore: 80 };
const tue = new Date("2026-11-24T13:30:00Z");
const mon = new Date("2026-11-23T13:30:00Z");
const djobs = [
  base,
  { ...base, key: "d2", company: "Glean", fitScore: 90 },
  { ...base, key: "d3", status: "dismissed" as const },
  { ...base, key: "d4", firstSeen: "2026-11-21T20:00:00Z" }, // Saturday
  { ...base, key: "d5", closedAt: "2026-11-24T01:00:00Z" },
];
ok("Digest: new Job Matches since the last weekday Digest, best fit first", () => {
  assert.deepEqual(newJobMatches(djobs, tue).map((j) => j.key), ["d2", "d1"]);
  assert.deepEqual(newJobMatches(djobs, mon).map((j) => j.key), ["d4"]); // Monday covers the weekend
  const d = buildDigest([], [], "https://example.com", tue, djobs);
  assert.ok(d.send);
  assert.equal(d.subject, "Job search: 2 new job matches");
  assert.ok(d.text.indexOf("Glean") < d.text.indexOf("Hex"));
  assert.ok(d.text.includes("Glean · Sales Engineer (Remote - US), fit 90%"));
  assert.ok(d.html.includes("https://example.com/admin/jobs"));
  assert.equal(d.counts.jobMatches, 2);
});

console.log("\nAll Job Match tests passed.");
