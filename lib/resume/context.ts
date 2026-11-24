import type { Fit } from "@/lib/chains";
import { loadKnowledge } from "@/lib/knowledge";
import { listExperience } from "@/lib/admin/experience";
import { getJob } from "@/lib/admin/job-scan";
import { getItem } from "@/lib/admin/repo";
import { BASE } from "./base";
import { buildSources, type SourceRef } from "./sources";
import { ownerString, type Owner } from "./store";

// What tailoring needs to know about the posting it's for, whether that's a
// Job Match (before applying) or an Application.

export const MIN_POSTING = 200;

export type OwnerContext = {
  owner: Owner;
  ownerStr: string;
  company: string;
  title: string;
  posting: string;
  notes?: string;
  fit?: Fit;
  editorUrl: string;
  backUrl: string;
};

export async function loadOwner(owner: Owner): Promise<OwnerContext | null> {
  const ownerStr = ownerString(owner);
  if (owner.kind === "app") {
    const item = await getItem(owner.id);
    if (!item || item.kind !== "application") return null;
    return {
      owner,
      ownerStr,
      company: item.company,
      title: item.role,
      posting: item.jobDescription ?? "",
      notes: item.notes,
      fit: item.fit,
      editorUrl: `/admin/items/${item.id}/resume`,
      backUrl: `/admin/items/${item.id}`,
    };
  }
  const job = await getJob(owner.key);
  if (!job) return null;
  return {
    owner,
    ownerStr,
    company: job.company,
    title: job.title,
    posting: job.description,
    fit: job.fit,
    editorUrl: `/admin/jobs/${encodeURIComponent(job.key)}/resume`,
    backUrl: "/admin/jobs",
  };
}

export async function sourcesFor(ctx: OwnerContext): Promise<SourceRef[]> {
  const [docs, bank] = await Promise.all([loadKnowledge(), listExperience()]);
  return buildSources({
    base: BASE,
    stories: docs.map((d) => ({ heading: String(d.metadata.section ?? d.metadata.source ?? ""), text: d.pageContent })),
    bank,
    notes: ctx.notes,
  });
}
