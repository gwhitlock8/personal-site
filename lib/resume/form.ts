import type { Line } from "./checks";
import type { TailoredResume } from "./generate";

// Turns the editor's form back into a draft. Field names:
//   tagline, summary.text, summary.sources ("B-summary, E1")
//   role.<roleId>.<i>.text | .sources | .order, role.<roleId>.new
//   ach.<i>.title | .text | .sources, skills.<i>.group | .items, certifications
// An emptied bullet is removed; a typed new bullet has no sources (flagged).

const MAX = 600;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim().slice(0, MAX);
const ids = (f: FormData, k: string) =>
  str(f, k)
    .split(/[\s,]+/)
    .filter((x) => /^[A-Za-z0-9-]+$/.test(x));

function indexed(f: FormData, prefix: string): number[] {
  const seen = new Set<number>();
  for (const k of f.keys()) {
    const m = k.match(new RegExp(`^${prefix.replace(/\./g, "\\.")}\\.(\\d+)\\.`));
    if (m) seen.add(Number(m[1]));
  }
  return [...seen].sort((a, b) => a - b);
}

export function draftFromForm(f: FormData, prev: TailoredResume): TailoredResume {
  const roles = prev.roles.map((role) => {
    const prefix = `role.${role.roleId}`;
    const rows = indexed(f, prefix);
    if (!rows.length && !str(f, `${prefix}.new`)) return role;
    const bullets: (Line & { order: number })[] = rows
      .map((i) => ({
        text: str(f, `${prefix}.${i}.text`),
        sources: ids(f, `${prefix}.${i}.sources`),
        order: Number(str(f, `${prefix}.${i}.order`)) || i + 1,
      }))
      .filter((b) => b.text);
    bullets.sort((a, b) => a.order - b.order);
    const typed = str(f, `${prefix}.new`);
    if (typed) bullets.push({ text: typed, sources: [], order: Infinity });
    return { roleId: role.roleId, bullets: bullets.map((b, i) => ({ text: b.text, sources: b.sources, priority: i + 1 })) };
  });

  const achievements = indexed(f, "ach")
    .map((i) => ({ title: str(f, `ach.${i}.title`), text: str(f, `ach.${i}.text`), sources: ids(f, `ach.${i}.sources`) }))
    .filter((a) => a.title && a.text);
  const skills = indexed(f, "skills")
    .map((i) => ({ group: str(f, `skills.${i}.group`), items: str(f, `skills.${i}.items`) }))
    .filter((g) => g.group && g.items);
  const certifications = str(f, "certifications");

  return {
    tagline: str(f, "tagline") || prev.tagline,
    summary: { text: str(f, "summary.text") || prev.summary.text, sources: f.has("summary.sources") ? ids(f, "summary.sources") : prev.summary.sources },
    roles,
    achievements: achievements.length ? achievements : prev.achievements,
    skills: skills.length ? skills : prev.skills,
    ...(certifications ? { certifications } : {}),
    emphasis: prev.emphasis,
    gaps: prev.gaps,
    cut: [],
  };
}
