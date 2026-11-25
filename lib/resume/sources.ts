import { createHash } from "node:crypto";
import { experienceId, type ExperienceEntry } from "@/lib/admin/experience";
import type { BaseResume } from "./types";

// Everything a tailored resume may draw on, each with an id the model must cite.
// Ids are stable, so a saved draft's citations keep pointing at the same text:
//   B-…  base resume (summary, bullets, achievements)
//   S-…  career stories, profile and skills, from the section heading
//   E-…  Experience bank entries, from the entry's own id
//   N-…  this Application's notes (one per paragraph), from a hash of the text

export type SourceRef = { id: string; text: string; where?: string; useWhen?: string };

export function buildSources(input: {
  base: BaseResume;
  stories: { heading: string; text: string }[];
  bank: ExperienceEntry[];
  notes?: string;
}): SourceRef[] {
  const { base } = input;
  const out: SourceRef[] = [{ id: base.summary.id, text: base.summary.text, where: "summary" }];
  for (const r of base.roles) for (const b of r.bullets) out.push({ id: b.id, text: b.text, where: `${r.title}, ${r.company}` });
  for (const a of base.achievements) out.push({ id: a.id, text: `${a.title}: ${a.text}`, where: "achievement" });
  const used = new Set<string>();
  const unique = (id: string) => {
    let candidate = id;
    for (let n = 2; used.has(candidate); n++) candidate = `${id}-${n}`;
    used.add(candidate);
    return candidate;
  };
  for (const s of input.stories) {
    const slug = s.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "section";
    out.push({ id: unique(`S-${slug}`), text: `${s.heading}: ${s.text}` });
  }
  for (const e of input.bank) {
    out.push({ id: unique(experienceId(e)), text: e.proof ? `${e.what} (${e.proof})` : e.what, where: e.where, ...(e.useWhen ? { useWhen: e.useWhen } : {}) });
  }
  (input.notes ?? "")
    .split(/\n\s*\n/)
    .map((n) => n.trim())
    .filter(Boolean)
    .forEach((n) => out.push({ id: unique(`N-${createHash("sha1").update(n).digest("hex").slice(0, 6)}`), text: n, where: "notes for this application" }));
  return out;
}
