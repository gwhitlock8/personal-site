"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { addExperience, listExperience, saveExperience } from "@/lib/admin/experience";

const field = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
const optional = (f: FormData, k: string, max: number) => field(f, k, max) || undefined;

export async function addEntry(form: FormData) {
  await requireAdmin();
  const what = field(form, "what", 600);
  const where = field(form, "where", 80);
  if (!what || !where) redirect("/admin/experience?error=missing");
  await addExperience({ what, where, proof: optional(form, "proof", 200), useWhen: optional(form, "useWhen", 200) });
  revalidatePath("/admin", "layout");
  const back = field(form, "back", 300);
  redirect(back.startsWith("/admin/") ? back : "/admin/experience");
}

export async function updateEntry(id: string, form: FormData) {
  await requireAdmin();
  const what = field(form, "what", 600);
  const where = field(form, "where", 80);
  if (!what || !where) redirect("/admin/experience?error=missing");
  const list = await listExperience();
  const e = list.find((x) => x.id === id);
  if (e) Object.assign(e, { what, where, proof: optional(form, "proof", 200), useWhen: optional(form, "useWhen", 200) });
  await saveExperience(list);
  revalidatePath("/admin", "layout");
}

export async function deleteEntry(id: string) {
  await requireAdmin();
  await saveExperience((await listExperience()).filter((e) => e.id !== id));
  revalidatePath("/admin", "layout");
}
