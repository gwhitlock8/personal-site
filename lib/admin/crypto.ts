import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Password hashing and signed session tokens for the single admin user.
// Pure functions (no Next.js imports) so the test suite can exercise them.

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
export const SESSION_DAYS = 30;

/** Format: scrypt:<salt>:<key>. Uses ":" because Next's env loader expands "$". */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, SCRYPT);
  return `scrypt:${salt.toString("base64url")}:${key.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, salt, key] = stored.split(":");
  if (alg !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), expected.length, SCRYPT);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function sessionKey(): string {
  const key = process.env.ADMIN_SESSION_SECRET;
  if (!key || key.length < 32) throw new Error("ADMIN_SESSION_SECRET is missing or shorter than 32 characters.");
  return key;
}

/** A session token is <payload>.<HMAC>; the payload only holds the expiry time. */
export function signSession(key: string, nowMs = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ exp: nowMs + SESSION_DAYS * 86_400_000 })).toString("base64url");
  const sig = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined, key: string, nowMs = Date.now()): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", key).update(payload).digest();
  const actual = Buffer.from(sig, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof exp === "number" && exp > nowMs;
  } catch {
    return false;
  }
}
