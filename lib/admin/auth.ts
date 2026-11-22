import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_DAYS, sessionKey, signSession, verifyPassword, verifySession } from "./crypto";
import { verifyTotp } from "./totp";
import { adminDb } from "./db";

// Admin login: password + authenticator code, a signed 30-day session cookie,
// and lockouts. Every admin page and server action calls requireAdmin().

const COOKIE = "admin_session";
const LOCK_SEC = 15 * 60;
const MAX_FAILS = 5; // per IP, then a 15-minute lock
const MAX_FAILS_GLOBAL = 20; // across all IPs per hour, in case of a distributed attempt

export async function isAdmin(): Promise<boolean> {
  try {
    return verifySession((await cookies()).get(COOKIE)?.value, sessionKey());
  } catch {
    return false;
  }
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function attemptLogin(ip: string, password: string, code: string): Promise<LoginResult> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  const totpSecret = process.env.ADMIN_TOTP_SECRET;
  if (!hash || !totpSecret || !process.env.ADMIN_SESSION_SECRET) {
    return { ok: false, error: "Admin login isn't configured yet. Run npm run admin:setup and add the values to Vercel." };
  }

  const db = adminDb();
  const lockKey = `login:lock:${ip}`;
  const failKey = `login:fail:${ip}`;
  const globalKey = `login:fail:all:${Math.floor(Date.now() / 3_600_000)}`;
  const locked = "Too many failed attempts. Try again in 15 minutes.";

  if (await db.get(lockKey)) return { ok: false, error: locked };
  if (Number((await db.get(globalKey)) ?? 0) >= MAX_FAILS_GLOBAL) return { ok: false, error: locked };

  const passwordOk = verifyPassword(password, hash);
  const step = verifyTotp(totpSecret, code.replace(/\s/g, ""));
  const lastStep = Number((await db.get("login:totp:last")) ?? -1);

  // A code can only be used once (step must be newer than the last one accepted).
  if (passwordOk && step !== null && step > lastStep) {
    await db.set("login:totp:last", String(step));
    await db.del(failKey);
    (await cookies()).set(COOKIE, signSession(sessionKey()), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 86_400,
    });
    return { ok: true };
  }

  const fails = await db.incr(failKey, LOCK_SEC);
  await db.incr(globalKey, 3_600);
  if (fails >= MAX_FAILS) {
    await db.set(lockKey, "1", LOCK_SEC);
    await db.del(failKey);
    return { ok: false, error: locked };
  }
  return { ok: false, error: "Incorrect password or code." };
}

export async function logout(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
