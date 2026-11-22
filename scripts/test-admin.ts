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

console.log("\nAll admin tests passed.");
