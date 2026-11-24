"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { addExperience } from "@/lib/admin/experience";
import { RateLimited } from "@/lib/admin/ingest";
import { getItem, saveItem } from "@/lib/admin/repo";
import { BASE } from "@/lib/resume/base";
import { resumeBlockedTerms } from "@/lib/resume/checks";
import { loadOwner, MIN_POSTING, sourcesFor, type OwnerContext } from "@/lib/resume/context";
import { draftFromForm } from "@/lib/resume/form";
import { generateDraft, type TailoredResume } from "@/lib/resume/generate";
import { fitToOnePage } from "@/lib/resume/pdf/render";
import { BlobNotConfigured, deleteSaved, discardDraft, getResume, parseOwner, saveDraft, savePdfs } from "@/lib/resume/store";

async function load(ownerStr: string): Promise<OwnerContext> {
  await requireAdmin();
  const owner = parseOwner(ownerStr);
  const ctx = owner ? await loadOwner(owner) : null;
  if (!ctx) redirect("/admin");
  return ctx;
}

const back = (ctx: OwnerContext, query = "") => redirect(`${ctx.editorUrl}${query}`);

export async function tailor(ownerStr: string) {
  const ctx = await load(ownerStr);
  if (ctx.posting.length < MIN_POSTING) back(ctx, "?error=no-jd");
  try {
    const draft = await generateDraft({ posting: ctx.posting, fit: ctx.fit, sources: await sourcesFor(ctx) });
    await saveDraft(ctx.owner, draft);
  } catch (err) {
    if (err instanceof RateLimited) back(ctx, "?error=rate-limit");
    console.error("tailoring failed", err);
    back(ctx, "?error=generate");
  }
  revalidatePath("/admin", "layout");
  back(ctx);
}

export async function saveEdits(ownerStr: string, form: FormData) {
  const ctx = await load(ownerStr);
  const { draft } = await getResume(ctx.owner);
  if (!draft) back(ctx);
  await saveDraft(ctx.owner, draftFromForm(form, draft!));
  const layout = form.get("layout") === "ats" ? "?layout=ats" : "";
  back(ctx, layout);
}

/** Saves the editor's current fields first, so unsaved edits are never lost, then renders and stores both PDFs. */
export async function savePdf(ownerStr: string, form: FormData) {
  const ctx = await load(ownerStr);
  const { draft: stored } = await getResume(ctx.owner);
  if (!stored) back(ctx);
  const draft = form.has("tagline") ? draftFromForm(form, stored!) : stored!;
  await saveDraft(ctx.owner, draft);
  const blocked = resumeBlockedTerms(draft);
  if (blocked.length) back(ctx, `?error=blocked&terms=${encodeURIComponent(blocked.join(", "))}`);
  const fitted = await fitToOnePage(draft, BASE);
  try {
    const saved = await savePdfs(ctx.owner, { designed: fitted.designed, ats: fitted.ats, company: ctx.company });
    await saveDraft(ctx.owner, fitted.resume);
    if (ctx.owner.kind === "app") {
      const item = await getItem(ctx.owner.id);
      if (item?.kind === "application") {
        item.resumeVersion = `Tailored (${saved.at.slice(0, 10)})`;
        await saveItem(item);
      }
    }
  } catch (err) {
    if (err instanceof BlobNotConfigured) back(ctx, "?error=blob");
    throw err;
  }
  revalidatePath("/admin", "layout");
  back(ctx, "?saved=1");
}

export async function addGapToBank(ownerStr: string, form: FormData) {
  const ctx = await load(ownerStr);
  const what = String(form.get("what") ?? "").trim().slice(0, 600);
  const where = String(form.get("where") ?? "").trim().slice(0, 80);
  if (!what || !where) back(ctx, "?error=bank");
  await addExperience({ what, where });
  back(ctx, "?added=1");
}

/** Deletes one saved resume's two PDFs from Blob and the list. */
export async function deleteSavedPdf(ownerStr: string, id: string, form: FormData) {
  const ctx = await load(ownerStr);
  try {
    await deleteSaved(ctx.owner, id);
  } catch (err) {
    console.error("deleting a saved resume failed", err);
    back(ctx, "?error=delete");
  }
  revalidatePath("/admin", "layout");
  const to = String(form.get("back") ?? "");
  redirect(to.startsWith("/admin/") ? to : `${ctx.editorUrl}?deleted=1`);
}

/** Clears the draft so tailoring can start over; saved PDFs stay. */
export async function discardDraftAction(ownerStr: string) {
  const ctx = await load(ownerStr);
  await discardDraft(ctx.owner);
  revalidatePath("/admin", "layout");
  back(ctx, "?discarded=1");
}
