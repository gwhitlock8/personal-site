// Offline tests for the admin: authenticator codes, passwords, sessions and
// follow-up rules. No keys or database needed.
//   npm test

import assert from "node:assert/strict";
import { base32Decode, base32Encode, hotp, newTotpSecret, totpCounter, verifyTotp } from "../lib/admin/totp";
import { hashPassword, signSession, verifyPassword, verifySession } from "../lib/admin/crypto";
import { businessDaysBetween, followUp, type Application, type Opportunity } from "../lib/admin/pipeline";

function ok(name: string, fn: () => void) {
  fn();
  console.log(`ok  ${name}`);
}

// ---- TOTP (RFC 6238 SHA-1 test vectors, 8 digits) ----
ok("RFC 6238 test vectors", () => {
  const secret = Buffer.from("12345678901234567890");
  assert.equal(hotp(secret, totpCounter(59_000), 8), "94287082");
  assert.equal(hotp(secret, totpCounter(1_111_111_109_000), 8), "07081804");
  assert.equal(hotp(secret, totpCounter(2_000_000_000_000), 8), "69279037");
});

ok("base32 round trip", () => {
  const buf = Buffer.from("12345678901234567890");
  assert.equal(base32Encode(buf), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.deepEqual(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq"), buf);
});

ok("verifyTotp accepts current and adjacent steps, rejects others", () => {
  const secret = newTotpSecret();
  const now = 1_800_000_000_000;
  const step = totpCounter(now);
  const code = (s: number) => hotp(base32Decode(secret), s);
  assert.equal(verifyTotp(secret, code(step), now), step);
  assert.equal(verifyTotp(secret, code(step - 1), now), step - 1);
  assert.equal(verifyTotp(secret, code(step + 1), now), step + 1);
  assert.equal(verifyTotp(secret, code(step - 3), now), null);
  assert.equal(verifyTotp(secret, "12345", now), null);
  assert.equal(verifyTotp(secret, "abcdef", now), null);
});

// ---- Passwords ----
ok("password hash verifies and rejects", () => {
  const h = hashPassword("correct horse battery");
  assert.ok(h.startsWith("scrypt:") && !h.includes("$"));
  assert.ok(verifyPassword("correct horse battery", h));
  assert.ok(!verifyPassword("correct horse batterY", h));
  assert.ok(!verifyPassword("anything", "garbage"));
});

// ---- Sessions ----
ok("session tokens: valid, expired, tampered, wrong key", () => {
  const key = "k".repeat(40);
  const now = 1_800_000_000_000;
  const token = signSession(key, now);
  assert.ok(verifySession(token, key, now + 1000));
  assert.ok(!verifySession(token, key, now + 31 * 86_400_000));
  assert.ok(!verifySession(token, "x".repeat(40), now));
  const [p, s] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ exp: now * 10 })).toString("base64url");
  assert.ok(!verifySession(`${forged}.${s}`, key, now));
  assert.ok(!verifySession(`${p}.`, key, now));
  assert.ok(!verifySession(undefined, key, now));
});

// ---- Follow-up rules ----
const base = { company: "Acme", role: "SE", createdAt: "", updatedAt: "" };
const app = (stage: Application["stage"], lastEventAt: string): Application => ({
  ...base, id: "a", kind: "application", stage, appliedOn: "2026-11-01", source: "manual", lastEventAt,
});
const opp = (lastEventAt: string, status: Opportunity["status"] = "open"): Opportunity => ({
  ...base, id: "o", kind: "opportunity", status, lastEventAt,
});

ok("business days skip weekends", () => {
  // Fri Nov 20 2026 -> Tue Nov 24 2026 = Mon, Tue = 2
  assert.equal(businessDaysBetween(new Date("2026-11-20T15:00:00Z"), new Date("2026-11-24T15:00:00Z")), 2);
  assert.equal(businessDaysBetween(new Date("2026-11-21T15:00:00Z"), new Date("2026-11-22T15:00:00Z")), 0);
});

ok("Applied: 7 days nudge, 30 days suggest closing", () => {
  const now = new Date("2026-11-21T15:00:00Z");
  assert.equal(followUp(app("Applied", "2026-11-16T15:00:00Z"), now), null);
  assert.match(followUp(app("Applied", "2026-11-14T15:00:00Z"), now)!.reason, /7 days/);
  assert.ok(followUp(app("Applied", "2026-10-20T15:00:00Z"), now)!.suggestClose);
});

ok("interview Stages: 4 business days", () => {
  const now = new Date("2026-11-24T15:00:00Z"); // Tuesday
  assert.equal(followUp(app("Recruiter Screen", "2026-11-19T15:00:00Z"), now), null); // Thu -> Tue = 3
  assert.ok(followUp(app("Demo", "2026-11-18T15:00:00Z"), now)); // Wed -> Tue = 4
});

ok("open Opportunity: 2 business days; end states never due", () => {
  const now = new Date("2026-11-24T15:00:00Z");
  assert.ok(followUp(opp("2026-11-20T15:00:00Z"), now));
  assert.equal(followUp(opp("2026-11-23T15:00:00Z"), now), null);
  assert.equal(followUp(opp("2026-11-01T15:00:00Z", "declined"), now), null);
  assert.equal(followUp(app("Rejected", "2026-01-01T00:00:00Z"), now), null);
  assert.equal(followUp(app("Offer", "2026-01-01T00:00:00Z"), now), null);
});

// ---- Email matching ----
import { companiesMatch, domainLabel, emailDomain, isForwardMove, matchEmail, normalizeCompany, roleSimilarity } from "../lib/admin/matching";

ok("email domains and company names", () => {
  assert.equal(emailDomain("Jane Doe <jane@mail.rox.com>"), "mail.rox.com");
  assert.equal(emailDomain("no-reply@ashbyhq.com"), "ashbyhq.com");
  assert.equal(domainLabel("mail.rox.com"), "rox");
  assert.equal(domainLabel("acme.co.uk"), "acme");
  assert.equal(normalizeCompany("Rox Data Corp."), "roxdata");
  assert.ok(companiesMatch("Rox", "Rox Data Corp"));
  assert.ok(!companiesMatch("Ro", "Rox"));
  assert.ok(!companiesMatch("Box", "Rox"));
  assert.ok(roleSimilarity("Solutions Engineer (Austin)", "Solutions Engineer") === 1);
  assert.ok(roleSimilarity("Account Executive", "Solutions Engineer") === 0);
});

ok("Stage proposals only move forward", () => {
  assert.ok(isForwardMove("Applied", "Recruiter Screen"));
  assert.ok(isForwardMove("Demo", "Rejected"));
  assert.ok(!isForwardMove("Technical", "Recruiter Screen"));
  assert.ok(!isForwardMove("Rejected", "Applied"));
  assert.ok(!isForwardMove("Applied", "Applied"));
});

const t = "2026-11-01T00:00:00Z";
const rox = { ...app("Applied", t), id: "rox", company: "Rox", role: "Solutions Engineer (Austin)" };
const roxAe = { ...app("Applied", t), id: "rox-ae", company: "Rox", role: "Account Executive" };
const acme = { ...opp(t), id: "acme", company: "Acme AI", role: "Sales Engineer", contact: "Sam <sam@acme.ai>" };

ok("matchEmail: company, domain, role, ambiguity", () => {
  const items = [rox, acme];
  let m = matchEmail(items, { company: "Rox Data Corp", role: "", fromAddress: "no-reply@ashbyhq.com" });
  assert.equal(m.type === "match" && m.item.id, "rox");
  m = matchEmail(items, { company: "", role: "", fromAddress: "Sam <sam@acme.ai>" });
  assert.equal(m.type === "match" && m.item.id, "acme");
  m = matchEmail(items, { company: "Unknown", role: "", fromAddress: "x@gmail.com" });
  assert.equal(m.type, "none");
  m = matchEmail([rox, roxAe], { company: "Rox", role: "Solutions Engineer", fromAddress: "a@rox.com" });
  assert.equal(m.type === "match" && m.item.id, "rox");
  m = matchEmail([rox, roxAe], { company: "Rox", role: "", fromAddress: "a@rox.com" });
  assert.equal(m.type, "ambiguous");
});

// ---- Ingest flow (in-memory store, stand-in classifier) ----
process.env.ADMIN_STORE = "memory";
const { ingestEmail } = await import("../lib/admin/ingest");
const repo = await import("../lib/admin/repo");
type C = import("../lib/admin/classify").Classification;
const classifier = (c: Partial<C>) => async () => ({ category: "other-job-related", company: "", role: "", stage: "none", summary: "s", ...c }) as C;
const email = (id: string, over: Partial<import("../lib/admin/pipeline").EmailRef> = {}) => ({
  messageId: id.padEnd(12, "0"), threadId: `t${id}`.padEnd(12, "0"), from: "no-reply@ashbyhq.com", subject: "Subject",
  date: "2026-11-10T15:00:00.000Z", snippet: "snippet", direction: "in" as const, link: "https://mail.google.com/x", ...over,
});

const results: string[] = [];
// 1. confirmation with no match -> creates an Application
results.push(await ingestEmail(email("a1"), classifier({ category: "application-confirmation", company: "Rox Data Corp", role: "Solutions Engineer", stage: "Applied", summary: "Thanks for applying" })));
// 2. same message again -> duplicate
results.push(await ingestEmail(email("a1"), classifier({})));
// 3. same thread, scheduling -> Event + Stage proposal
results.push(await ingestEmail(email("a2", { threadId: email("a1").threadId, date: "2026-11-12T15:00:00.000Z" }), classifier({ category: "scheduling", stage: "Recruiter Screen", summary: "Recruiter call booked" })));
// 4. Gavin's reply in that thread -> Event, no classifier call
results.push(await ingestEmail(email("a3", { threadId: email("a1").threadId, direction: "out", date: "2026-11-12T16:00:00.000Z" }), async () => { throw new Error("should not classify"); }));
// 5. outgoing mail outside tracked threads -> ignored
results.push(await ingestEmail(email("a4", { direction: "out" }), async () => { throw new Error("should not classify"); }));
// 6. newsletter -> ignored
results.push(await ingestEmail(email("a5"), classifier({ category: "not-job-related" })));
// 7. recruiter outreach, unknown company -> new-opportunity proposal
results.push(await ingestEmail(email("a6", { from: "Pat <pat@newco.ai>" }), classifier({ category: "recruiter-outreach", company: "NewCo", role: "Solutions Engineer" })));
// 8. classifier error -> throws, not marked seen
let threw = false;
try { await ingestEmail(email("a7"), async () => { throw new Error("model down"); }); } catch { threw = true; }

ok("ingest flow outcomes", () => {
  assert.deepEqual(results, ["created-application", "duplicate", "proposed", "attached", "ignored", "ignored", "proposed"]);
  assert.ok(threw);
});

const items = await repo.listItems();
const created = items.find((i) => i.company === "Rox Data Corp")!;
const events = await repo.listEvents(created.id);
const proposals = await repo.listProposals();
const seen7 = await repo.wasSeen(email("a7").messageId);

ok("ingest flow state", () => {
  assert.equal(items.length, 1);
  assert.equal(created.kind === "application" && created.stage, "Applied"); // stage NOT changed without approval
  assert.equal(events.length, 3); // created + scheduling email + reply
  assert.equal(created.lastEventAt, "2026-11-12T16:00:00.000Z");
  assert.deepEqual(proposals.map((p) => p.kind).sort(), ["new-opportunity", "stage"]);
  assert.equal(proposals.find((p) => p.kind === "stage")!.stage, "Recruiter Screen");
  assert.ok(!seen7); // retried next run
});

// ---- Model budget and rate limits ----
import http from "node:http";
import type { AddressInfo } from "node:net";
const { budgetedClassify, RateLimited } = await import("../lib/admin/ingest");

// Budget: capped per minute; test with a cap of 2 (retry once if the test straddles a minute boundary).
process.env.ADMIN_MODEL_RPM = "2";
let budget: boolean[] = [];
for (let attempt = 0; attempt < 2; attempt++) {
  const minute = Math.floor(Date.now() / 60_000);
  budget = [await repo.takeModelBudget(), await repo.takeModelBudget(), await repo.takeModelBudget()];
  if (Math.floor(Date.now() / 60_000) === minute) break;
}
ok("model budget enforces ADMIN_MODEL_RPM", () => assert.deepEqual(budget, [true, true, false]));

// A 429 from Moonshot becomes RateLimited ("deferred"), not an error.
const { adminDb } = await import("../lib/admin/db");
await adminDb().del(`model-budget:${Math.floor(Date.now() / 60_000)}`); // fresh budget for this test
const limiter = http.createServer((_req, res) => {
  res.writeHead(429, { "Content-Type": "application/json", "retry-after": "1" });
  res.end(JSON.stringify({ error: { message: "request reached organization max RPM: 3", type: "rate_limit_reached_error" } }));
});
await new Promise<void>((r) => limiter.listen(0, r));
process.env.MOONSHOT_BASE_URL = `http://127.0.0.1:${(limiter.address() as AddressInfo).port}/v1`;
process.env.MOONSHOT_API_KEY = "test-key";
let limitedErr: unknown;
try { await budgetedClassify(email("r1")); } catch (e) { limitedErr = e; }
limiter.close();
ok("Moonshot 429 becomes RateLimited", () => assert.ok(limitedErr instanceof RateLimited, String(limitedErr)));

console.log("\nAll admin tests passed.");
