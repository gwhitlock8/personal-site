import { randomUUID } from "node:crypto";
import { adminDb } from "./db";
import type { EventKind, EventRecord, Item, ProposedChange } from "./pipeline";

// Storage layout in the admin database:
//   items          sorted set of item ids, scored by updatedAt
//   item:<id>      JSON of an Application or Opportunity
//   events:<id>    list of Event JSON, newest first

const itemKey = (id: string) => `item:${id}`;
const eventsKey = (id: string) => `events:${id}`;

export const newId = () => randomUUID();

export async function listItems(): Promise<Item[]> {
  const db = adminDb();
  const ids = await db.zrevAll("items");
  const raw = await db.mget(ids.map(itemKey));
  return raw.filter((r): r is string => !!r).map((r) => JSON.parse(r) as Item);
}

export async function getItem(id: string): Promise<Item | null> {
  const raw = await adminDb().get(itemKey(id));
  return raw ? (JSON.parse(raw) as Item) : null;
}

export async function saveItem(item: Item): Promise<void> {
  const db = adminDb();
  item.updatedAt = new Date().toISOString();
  await db.set(itemKey(item.id), JSON.stringify(item));
  await db.zadd("items", Date.parse(item.updatedAt), item.id);
}

export async function deleteItem(id: string): Promise<void> {
  const db = adminDb();
  await db.zrem("items", id);
  await db.del(itemKey(id));
  await db.del(eventsKey(id));
}

export async function listEvents(id: string): Promise<EventRecord[]> {
  return (await adminDb().lrange(eventsKey(id))).map((r) => JSON.parse(r) as EventRecord);
}

/** Records an Event and resets the item's follow-up clock. */
export async function addEvent(item: Item, kind: EventKind, summary: string, link?: string, at = new Date()) {
  const event: EventRecord = { id: newId(), at: at.toISOString(), kind, summary, link };
  await adminDb().lpush(eventsKey(item.id), JSON.stringify(event));
  if (event.at > item.lastEventAt) item.lastEventAt = event.at;
  await saveItem(item);
  return event;
}

// ---- Email bookkeeping ----
//   seen:<messageId>    a message already processed (kept a year)
//   thread:<threadId>   the item a Gmail thread belongs to
//   proposals           sorted set of Proposed Change ids, by createdAt
//   proposal:<id>       JSON of a Proposed Change

const YEAR = 365 * 86_400;

export async function wasSeen(messageId: string) {
  return (await adminDb().get(`seen:${messageId}`)) !== null;
}
export async function markSeen(messageId: string) {
  await adminDb().set(`seen:${messageId}`, "1", YEAR);
}

export async function threadItem(threadId: string) {
  return adminDb().get(`thread:${threadId}`);
}
export async function linkThread(threadId: string, itemId: string) {
  const db = adminDb();
  await db.set(`thread:${threadId}`, itemId);
  await db.zadd("threads", Date.now(), threadId);
}
/** Thread ids tied to items, so the Gmail script can check them for new messages. */
export async function trackedThreads(): Promise<string[]> {
  return adminDb().zrevAll("threads");
}

export async function saveProposal(p: ProposedChange) {
  const db = adminDb();
  await db.set(`proposal:${p.id}`, JSON.stringify(p));
  await db.zadd("proposals", Date.parse(p.createdAt), p.id);
}
export async function getProposal(id: string): Promise<ProposedChange | null> {
  const raw = await adminDb().get(`proposal:${id}`);
  return raw ? (JSON.parse(raw) as ProposedChange) : null;
}
export async function listProposals(): Promise<ProposedChange[]> {
  const db = adminDb();
  const ids = await db.zrevAll("proposals");
  const raw = await db.mget(ids.map((id) => `proposal:${id}`));
  return raw.filter((r): r is string => !!r).map((r) => JSON.parse(r) as ProposedChange);
}
export async function removeProposal(id: string) {
  const db = adminDb();
  await db.zrem("proposals", id);
  await db.del(`proposal:${id}`);
}

// ---- Model budget ----
// Moonshot's free tier allows 3 requests a minute for the whole account, shared
// with the public chat assistant. Email classification takes at most 2 a minute,
// leaving room for visitors.

export const MODEL_CALLS_PER_MINUTE = 2;

/** Reserves one Kimi call for email classification; false when this minute's budget is used. */
export async function takeModelBudget(): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60_000);
  return (await adminDb().incr(`model-budget:${minute}`, 120)) <= MODEL_CALLS_PER_MINUTE;
}
