import { Redis } from "@upstash/redis";

// Storage for the admin area. By default it shares the site's existing Upstash
// database (the one holding public chat logs), with every key prefixed
// "admin:" so admin data never overlaps public data. The public code only
// touches its own keys (chats, leads, rate limits).
//
// Optional: to move admin data to its own database later, connect one in Vercel
// with the env var prefix "ADMIN" (ADMIN_KV_REST_API_URL / _TOKEN); it wins.
//
// For local testing only, ADMIN_STORE=memory keeps everything in process memory
// (lost on restart). Without any of these, admin features refuse to run rather
// than silently losing data.

export interface AdminKV {
  get(key: string): Promise<string | null>;
  mget(keys: string[]): Promise<(string | null)[]>;
  set(key: string, value: string, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSec?: number): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<void>;
  zrem(key: string, member: string): Promise<void>;
  /** All members, highest score first. */
  zrevAll(key: string): Promise<string[]>;
  lpush(key: string, value: string): Promise<void>;
  lrange(key: string): Promise<string[]>;
}

export class AdminStoreNotConfigured extends Error {
  constructor() {
    super("No database is connected. Connect Upstash for Redis in Vercel's Storage tab (the same one the public site uses).");
  }
}

function upstash(url: string, token: string): AdminKV {
  const r = new Redis({ url, token, automaticDeserialization: false });
  return {
    get: async (k) => (await r.get<string>(k)) ?? null,
    mget: async (keys) => (keys.length ? await r.mget<(string | null)[]>(...keys) : []),
    set: async (k, v, ttl) => {
      if (ttl) await r.set(k, v, { ex: ttl });
      else await r.set(k, v);
    },
    del: async (k) => {
      await r.del(k);
    },
    incr: async (k, ttl) => {
      const n = await r.incr(k);
      if (ttl && n === 1) await r.expire(k, ttl);
      return n;
    },
    zadd: async (k, score, member) => {
      await r.zadd(k, { score, member });
    },
    zrem: async (k, member) => {
      await r.zrem(k, member);
    },
    zrevAll: async (k) => (await r.zrange<string[]>(k, 0, -1, { rev: true })) ?? [],
    lpush: async (k, v) => {
      await r.lpush(k, v);
    },
    lrange: async (k) => (await r.lrange<string>(k, 0, -1)) ?? [],
  };
}

function memory(): AdminKV {
  const kv = new Map<string, { v: string; exp?: number }>();
  const zsets = new Map<string, Map<string, number>>();
  const lists = new Map<string, string[]>();
  const live = (k: string) => {
    const e = kv.get(k);
    if (e?.exp && e.exp < Date.now()) kv.delete(k);
    return kv.get(k)?.v ?? null;
  };
  return {
    get: async (k) => live(k),
    mget: async (keys) => keys.map(live),
    set: async (k, v, ttl) => {
      kv.set(k, { v, exp: ttl ? Date.now() + ttl * 1000 : undefined });
    },
    del: async (k) => {
      kv.delete(k);
      zsets.delete(k);
      lists.delete(k);
    },
    incr: async (k, ttl) => {
      const n = Number(live(k) ?? 0) + 1;
      const exp = kv.get(k)?.exp ?? (ttl ? Date.now() + ttl * 1000 : undefined);
      kv.set(k, { v: String(n), exp });
      return n;
    },
    zadd: async (k, score, member) => {
      if (!zsets.has(k)) zsets.set(k, new Map());
      zsets.get(k)!.set(member, score);
    },
    zrem: async (k, member) => {
      zsets.get(k)?.delete(member);
    },
    zrevAll: async (k) => [...(zsets.get(k) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m),
    lpush: async (k, v) => {
      if (!lists.has(k)) lists.set(k, []);
      lists.get(k)!.unshift(v);
    },
    lrange: async (k) => [...(lists.get(k) ?? [])],
  };
}

/** Prefixes every key so admin data can share a database with the public site. */
function prefixed(kv: AdminKV, prefix: string): AdminKV {
  const p = (k: string) => prefix + k;
  return {
    get: (k) => kv.get(p(k)),
    mget: (keys) => kv.mget(keys.map(p)),
    set: (k, v, ttl) => kv.set(p(k), v, ttl),
    del: (k) => kv.del(p(k)),
    incr: (k, ttl) => kv.incr(p(k), ttl),
    zadd: (k, score, member) => kv.zadd(p(k), score, member),
    zrem: (k, member) => kv.zrem(p(k), member),
    zrevAll: (k) => kv.zrevAll(p(k)),
    lpush: (k, v) => kv.lpush(p(k), v),
    lrange: (k) => kv.lrange(p(k)),
  };
}

export const ADMIN_PREFIX = "admin:";

let cached: AdminKV | null = null;

export function adminDb(): AdminKV {
  if (cached) return cached;
  const url =
    process.env.ADMIN_KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.ADMIN_KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  let base: AdminKV;
  if (url && token) base = upstash(url, token);
  else if (process.env.ADMIN_STORE === "memory") base = memory();
  else throw new AdminStoreNotConfigured();
  cached = prefixed(base, ADMIN_PREFIX);
  return cached;
}
