import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Time-based one-time codes (RFC 6238), the 6-digit codes an authenticator app
// shows. Built on node:crypto so the admin login adds no dependencies.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 character in TOTP secret.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** HMAC-based one-time password (RFC 4226). */
export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const offset = h[h.length - 1] & 0xf;
  const code =
    ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(code % 10 ** digits).padStart(digits, "0");
}

export const totpCounter = (nowMs = Date.now(), stepSec = 30) => Math.floor(nowMs / 1000 / stepSec);

/**
 * Checks a 6-digit code against the current 30-second step and one step either side
 * (clock drift). Returns the matching step counter, used to block replays, or null.
 */
export function verifyTotp(secretBase32: string, code: string, nowMs = Date.now(), window = 1): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const current = totpCounter(nowMs);
  let match: number | null = null;
  for (let i = -window; i <= window; i++) {
    const candidate = Buffer.from(hotp(secret, current + i));
    // Check every step (no early exit) so timing doesn't reveal which one matched.
    if (timingSafeEqual(candidate, Buffer.from(code)) && match === null) match = current + i;
  }
  return match;
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

export function otpauthUrl(secret: string, account = "admin", issuer = "gavinwhitlock.com") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
