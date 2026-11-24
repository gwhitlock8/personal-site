import { put as blobPut } from "@vercel/blob";
import { adminDb } from "@/lib/admin/db";
import type { TailoredResume } from "./generate";

// Tailored resume drafts and saved PDFs, per owner: a Job Match before Gavin
// applies, or an Application. Drafts live in the admin database
// (resume:app:<id> / resume:job:<key>); PDFs live in a private Vercel Blob store.

export type Owner = { kind: "app"; id: string } | { kind: "job"; key: string };
export type SavedResume = { at: string; designedUrl: string; atsUrl: string; fileBase: string };
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
  const saved: SavedResume = { at: new Date().toISOString(), designedUrl: designed.url, atsUrl: ats.url, fileBase };
  const rec = await getResume(o);
  await putRecord(o, { ...rec, saved: [saved, ...rec.saved] });
  return saved;
}
