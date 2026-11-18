import { Redis } from "@upstash/redis";

// Persistence: chat logs, leads and rate limiting.
//
// Uses Upstash Redis (add it from the Vercel Marketplace; it sets the env vars
// for you). If no Redis is configured, logs go to the console and rate limiting
// is skipped, so local development works without any setup.

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const KEEP = 5000; // cap list length so storage stays small

async function append(key: string, record: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), ...record };
  if (!redis) {
    console.log(`[${key}]`, JSON.stringify(entry));
    return;
  }
  try {
    await redis.lpush(key, JSON.stringify(entry));
    await redis.ltrim(key, 0, KEEP - 1);
  } catch (err) {
    console.error(`Failed to write ${key}`, err);
  }
}

export const logChat = (r: Record<string, unknown>) => append("chats", r);
export const logLead = (r: Record<string, unknown>) => append("leads", r);

/** Fixed-window limit: `limit` requests per `windowSec` per key. */
export async function rateLimit(key: string, limit = 20, windowSec = 600): Promise<boolean> {
  if (!redis) return true;
  try {
    const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
    const count = await redis.incr(bucket);
    if (count === 1) await redis.expire(bucket, windowSec);
    return count <= limit;
  } catch {
    return true; // fail open: a Redis hiccup shouldn't break the chat
  }
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
