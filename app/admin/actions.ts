"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { runFit } from "@/lib/chains";
import { attemptLogin, clientIp, logout, requireAdmin } from "@/lib/admin/auth";
import { AdminStoreNotConfigured } from "@/lib/admin/db";
import { addEvent, deleteItem, getItem, newId, saveItem } from "@/lib/admin/repo";
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
    const { fit } = await runFit(app.jobDescription);
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
  revalidatePath("/admin");
  redirect("/admin");
}
