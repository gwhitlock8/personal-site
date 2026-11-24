"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { runFit } from "@/lib/chains";
import { experienceAsContext, listExperience } from "@/lib/admin/experience";
import { attemptLogin, clientIp, logout, requireAdmin } from "@/lib/admin/auth";
import { AdminStoreNotConfigured } from "@/lib/admin/db";
import { addEvent, deleteItem, getItem, getProposal, linkThread, listProposals, newId, removeProposal, saveItem } from "@/lib/admin/repo";
import { logEmail, proposeStage } from "@/lib/admin/ingest";
import { isForwardMove } from "@/lib/admin/matching";
import { isStage, type Application, type Opportunity } from "@/lib/admin/pipeline";

const MIN_JD = 200;
const text = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? "").trim().slice(0, max);
const optional = (f: FormData, k: string, max = 2000) => text(f, k, max) || undefined;
const today = () => new Date().toISOString().slice(0, 10);

// ---- Login ----

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  try {
    const result = await attemptLogin(await clientIp(), String(form.get("password") ?? ""), String(form.get("code") ?? ""));
    if (!result.ok) return { error: result.error };
  } catch (err) {
    if (err instanceof AdminStoreNotConfigured) return { error: err.message };
    console.error("login error", err);
    return { error: "Login failed. Try again." };
  }
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

// ---- Fit Check ----

async function attachFit(app: Application) {
  if (!app.jobDescription || app.jobDescription.length < MIN_JD) return;
  try {
    const { fit } = await runFit(app.jobDescription, experienceAsContext(await listExperience()));
    app.fit = fit;
    app.fitCheckedAt = new Date().toISOString();
  } catch (err) {
    console.error("fit check failed", err); // the Application still saves; the button can retry
  }
}

// ---- Create ----

export async function createApplication(form: FormData) {
  await requireAdmin();
  const company = text(form, "company", 120);
  const role = text(form, "role", 160);
  if (!company || !role) redirect("/admin/new?error=missing");

  const now = new Date().toISOString();
  const app: Application = {
    id: newId(),
    kind: "application",
    company,
    role,
    url: optional(form, "url", 500),
    location: optional(form, "location", 120),
    stage: "Applied",
    appliedOn: text(form, "appliedOn", 10) || today(),
    resumeVersion: optional(form, "resumeVersion", 80),
    jobDescription: optional(form, "jobDescription", 12000),
    notes: optional(form, "notes", 4000),
    source: "manual",
    createdAt: now,
    updatedAt: now,
    lastEventAt: new Date(`${text(form, "appliedOn", 10) || today()}T12:00:00Z`).toISOString(),
  };
  await attachFit(app);
  await saveItem(app);
  await addEvent(app, "created", `Applied (added by hand)`, undefined, new Date(app.lastEventAt));
  redirect(`/admin/items/${app.id}`);
}

export async function createOpportunity(form: FormData) {
  await requireAdmin();
  const company = text(form, "company", 120);
  const role = text(form, "role", 160);
  if (!company || !role) redirect("/admin/new?type=opportunity&error=missing");

  const now = new Date().toISOString();
  const opp: Opportunity = {
    id: newId(),
    kind: "opportunity",
    company,
    role,
    contact: optional(form, "contact", 200),
    url: optional(form, "url", 500),
    notes: optional(form, "notes", 4000),
    status: "open",
    createdAt: now,
    updatedAt: now,
    lastEventAt: now,
  };
  await saveItem(opp);
  await addEvent(opp, "created", "Opportunity added by hand");
  redirect(`/admin/items/${opp.id}`);
}

// ---- Update ----

async function load(id: string) {
  await requireAdmin();
  const item = await getItem(id);
  if (!item) redirect("/admin");
  return item;
}

function done(id: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/items/${id}`);
}

export async function changeStage(id: string, form: FormData) {
  const item = await load(id);
  const stage = text(form, "stage", 40);
  if (item.kind !== "application" || !isStage(stage) || stage === item.stage) return;
  const from = item.stage;
  item.stage = stage;
  await addEvent(item, "stage-change", `${from} → ${stage}`);
  done(id);
}

export async function addNote(id: string, form: FormData) {
  const item = await load(id);
  const note = text(form, "note", 4000);
  if (!note) return;
  await addEvent(item, "note", note);
  done(id);
}

export async function updateDetails(id: string, form: FormData) {
  const item = await load(id);
  item.company = text(form, "company", 120) || item.company;
  item.role = text(form, "role", 160) || item.role;
  item.url = optional(form, "url", 500);
  item.notes = optional(form, "notes", 4000);
  if (item.kind === "application") {
    item.location = optional(form, "location", 120);
    item.resumeVersion = optional(form, "resumeVersion", 80);
    const jd = optional(form, "jobDescription", 12000);
    const changed = jd !== item.jobDescription;
    item.jobDescription = jd;
    if (changed) {
      item.fit = undefined;
      item.fitCheckedAt = undefined;
      await attachFit(item);
    }
  } else {
    item.contact = optional(form, "contact", 200);
  }
  await saveItem(item);
  done(id);
}

export async function rerunFit(id: string) {
  const item = await load(id);
  if (item.kind !== "application") return;
  await attachFit(item);
  await saveItem(item);
  done(id);
}

// ---- Opportunities ----

export async function pursueOpportunity(id: string) {
  const opp = await load(id);
  if (opp.kind !== "opportunity" || opp.status !== "open") return;
  const now = new Date().toISOString();
  const app: Application = {
    id: newId(),
    kind: "application",
    company: opp.company,
    role: opp.role,
    url: opp.url,
    notes: opp.notes,
    stage: "Applied",
    appliedOn: today(),
    source: "opportunity",
    opportunityId: opp.id,
    createdAt: now,
    updatedAt: now,
    lastEventAt: now,
  };
  await saveItem(app);
  await addEvent(app, "created", "Applied (from an Opportunity)");
  opp.status = "pursued";
  opp.applicationId = app.id;
  await addEvent(opp, "note", "Pursued; became an Application");
  redirect(`/admin/items/${app.id}`);
}

export async function declineOpportunity(id: string) {
  const opp = await load(id);
  if (opp.kind !== "opportunity" || opp.status !== "open") return;
  opp.status = "declined";
  await addEvent(opp, "note", "Declined");
  done(id);
}

// ---- Delete ----

export async function removeItem(id: string, form: FormData) {
  await load(id);
  if (form.get("confirm") !== "yes") return;
  await deleteItem(id);
  for (const p of await listProposals()) if (p.itemId === id) await removeProposal(p.id);
  revalidatePath("/admin");
  redirect("/admin");
}

// ---- Proposed Changes ----

export async function approveProposal(id: string, form: FormData) {
  await requireAdmin();
  const p = await getProposal(id);
  if (!p) return;

  if (p.kind === "stage" && p.itemId && p.stage) {
    const item = await getItem(p.itemId);
    if (item?.kind === "application" && isForwardMove(item.stage, p.stage)) {
      const from = item.stage;
      item.stage = p.stage;
      await addEvent(item, "stage-change", `${from} → ${p.stage} (from an email: ${p.reason})`, p.email.link);
    }
  }

  if (p.kind === "attach") {
    const chosen = String(form.get("itemId") ?? "");
    if (!p.candidateIds?.includes(chosen)) return;
    const item = await getItem(chosen);
    if (!item) return;
    await logEmail(item, p.email, p.reason);
    await proposeStage(item, p.email, p.suggestedStage, p.reason);
  }

  if (p.kind === "new-opportunity") {
    const company = text(form, "company", 120) || p.company || "";
    const role = text(form, "role", 160) || p.role || "";
    if (!company || !role) return;
    const now = new Date().toISOString();
    const opp: Opportunity = {
      id: newId(),
      kind: "opportunity",
      company,
      role,
      contact: p.email.from.slice(0, 200),
      status: "open",
      createdAt: now,
      updatedAt: now,
      lastEventAt: p.email.date,
    };
    await saveItem(opp);
    await addEvent(opp, "created", `Opportunity from an email: ${p.reason}`, p.email.link, new Date(p.email.date));
    await linkThread(p.email.threadId, opp.id);
  }

  await removeProposal(id);
  revalidatePath("/admin", "layout");
}

export async function dismissProposal(id: string) {
  await requireAdmin();
  await removeProposal(id);
  revalidatePath("/admin", "layout");
}
