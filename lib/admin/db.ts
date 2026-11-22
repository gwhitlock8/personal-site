import { Redis } from "@upstash/redis";

// Storage for the admin area: a second Upstash database, separate from the
// public chat logs. Connect it in Vercel with the env var prefix "ADMIN" so it
// sets ADMIN_KV_REST_API_URL and ADMIN_KV_REST_API_TOKEN.
//
// For local testing only, ADMIN_STORE=memory keeps everything in process memory
// (lost on restart). Without either, admin features refuse to run rather than
// silently losing data.

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
    super("The admin database isn't connected. Add a second Upstash database in Vercel with the ADMIN prefix.");
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

let cached: AdminKV | null = null;

export function adminDb(): AdminKV {
  if (cached) return cached;
  const url = process.env.ADMIN_KV_REST_API_URL;
  const token = process.env.ADMIN_KV_REST_API_TOKEN;
  if (url && token) cached = upstash(url, token);
  else if (process.env.ADMIN_STORE === "memory") cached = memory();
  else throw new AdminStoreNotConfigured();
  return cached;
}
