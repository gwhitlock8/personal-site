import { randomUUID } from "node:crypto";
import { adminDb } from "./db";
import type { EventKind, EventRecord, Item } from "./pipeline";

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
