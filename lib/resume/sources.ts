import type { ExperienceEntry } from "@/lib/admin/experience";
import type { BaseResume } from "./types";

// Everything a tailored resume may draw on, each with an id the model must cite:
//   B  base resume (summary, bullets, achievements)
//   S  career stories, profile and skills (content/*.md sections)
//   E  Experience bank entries
//   N  this Application's notes, split on blank lines

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
  input.stories.forEach((s, i) => out.push({ id: `S${i + 1}`, text: `${s.heading}: ${s.text}` }));
  input.bank.forEach((e, i) =>
    out.push({ id: `E${i + 1}`, text: e.proof ? `${e.what} (${e.proof})` : e.what, where: e.where, ...(e.useWhen ? { useWhen: e.useWhen } : {}) }),
  );
  (input.notes ?? "")
    .split(/\n\s*\n/)
    .map((n) => n.trim())
    .filter(Boolean)
    .forEach((n, i) => out.push({ id: `N${i + 1}`, text: n, where: "notes for this application" }));
  return out;
}
