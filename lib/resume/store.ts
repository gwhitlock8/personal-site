import { randomUUID } from "node:crypto";
import { del as blobDel, put as blobPut } from "@vercel/blob";
import { adminDb } from "@/lib/admin/db";
import type { TailoredResume } from "./generate";

// Tailored resume drafts and saved PDFs, per owner: a Job Match before Gavin
// applies, or an Application. Drafts live in the admin database
// (resume:app:<id> / resume:job:<key>); PDFs live in a private Vercel Blob store.

export type Owner = { kind: "app"; id: string } | { kind: "job"; key: string };
export type SavedResume = { id: string; at: string; designedUrl: string; atsUrl: string; fileBase: string };
export type ResumeRecord = { draft?: TailoredResume; saved: SavedResume[] };

export type BlobPut = (
  path: string,
  body: Buffer,
  opts: { access: "private"; addRandomSuffix: true; contentType: string },
) => Promise<{ url: string; pathname: string }>;

export class BlobNotConfigured extends Error {
  constructor() {
    super("Add a Blob store in Vercel (Storage → Blob) to save PDFs.");
  }
}

export const ownerString = (o: Owner) => (o.kind === "app" ? `app:${o.id}` : `job:${o.key}`);

export function parseOwner(s: string): Owner | null {
  const m = s.match(/^(app|job):(.+)$/);
  if (!m) return null;
  return m[1] === "app" ? { kind: "app", id: m[2] } : { kind: "job", key: m[2] };
}

const key = (o: Owner) => `resume:${ownerString(o)}`;

export async function getResume(o: Owner): Promise<ResumeRecord> {
  const raw = await adminDb().get(key(o));
  return raw ? (JSON.parse(raw) as ResumeRecord) : { saved: [] };
}

/** Records for several owners in one read (for the Job Matches list). */
export async function getResumes(owners: Owner[]): Promise<ResumeRecord[]> {
  if (!owners.length) return [];
  const raw = await adminDb().mget(owners.map(key));
  return raw.map((r) => (r ? (JSON.parse(r) as ResumeRecord) : { saved: [] }));
}

async function putRecord(o: Owner, r: ResumeRecord) {
  await adminDb().set(key(o), JSON.stringify(r));
}

export async function saveDraft(o: Owner, draft: TailoredResume) {
  await putRecord(o, { ...(await getResume(o)), draft });
}

/** Moves a Job Match's draft and saved files to its new Application. No-op when there's nothing to move. */
export async function moveOwner(from: Owner, to: Owner) {
  const rec = await adminDb().get(key(from));
  if (!rec) return;
  await adminDb().set(key(to), rec);
  await adminDb().del(key(from));
}

const blobConfigured = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Company";

const defaultPut: BlobPut = (path, body, opts) => blobPut(path, body, opts);

export async function savePdfs(o: Owner, files: { designed: Buffer; ats: Buffer; company: string }, put: BlobPut = defaultPut): Promise<SavedResume> {
  if (!blobConfigured()) throw new BlobNotConfigured();
  const fileBase = `Gavin-Whitlock-Resume-${slug(files.company)}-${new Date().toISOString().slice(0, 10)}`;
  const opts = { access: "private", addRandomSuffix: true, contentType: "application/pdf" } as const;
  let designed, ats;
  try {
    designed = await put(`resumes/${fileBase}.pdf`, files.designed, opts);
    ats = await put(`resumes/${fileBase}-ATS.pdf`, files.ats, opts);
  } catch (err) {
    if (/store|token|unauthori[sz]ed|forbidden/i.test(String((err as Error)?.message ?? err))) throw new BlobNotConfigured();
    throw err;
  }
  const saved: SavedResume = { id: randomUUID(), at: new Date().toISOString(), designedUrl: designed.url, atsUrl: ats.url, fileBase };
  const rec = await getResume(o);
  await putRecord(o, { ...rec, saved: [saved, ...rec.saved] });
  return saved;
}

export type BlobDel = (urls: string[]) => Promise<void>;
const defaultDel: BlobDel = (urls) => blobDel(urls);

/**
 * Deletes one saved resume (both PDFs) from Blob, then from the list. A file
 * already gone from Blob still leaves the list; any other Blob failure keeps
 * the row so it can be retried.
 */
export async function deleteSaved(o: Owner, id: string, del: BlobDel = defaultDel): Promise<void> {
  const rec = await getResume(o);
  const row = rec.saved.find((s) => s.id === id);
  if (!row) return;
  try {
    await del([row.designedUrl, row.atsUrl]);
  } catch (err) {
    const e = err as Error;
    if (!(e?.name === "BlobNotFoundError" || /does not exist|not found/i.test(String(e?.message)))) throw err;
  }
  await putRecord(o, { ...rec, saved: rec.saved.filter((s) => s.id !== id) });
}

/** Clears the draft; saved PDFs stay. Removes the record when nothing is left. */
export async function discardDraft(o: Owner): Promise<void> {
  const rec = await getResume(o);
  if (rec.saved.length) await putRecord(o, { saved: rec.saved });
  else await adminDb().del(key(o));
}
