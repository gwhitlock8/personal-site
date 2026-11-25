// Renders the general resume with the PDF templates, for visual checks.
//   npx tsx scripts/render-sample.ts <outdir>
import { writeFileSync } from "node:fs";
import path from "node:path";
import { BASE } from "../lib/resume/base";
import { renderPdf, toRenderable } from "../lib/resume/pdf/render";

const out = process.argv[2] ?? ".";
const t = {
  tagline: BASE.tagline,
  summary: { text: BASE.summary.text, sources: [BASE.summary.id] },
  roles: BASE.roles.map((r) => ({ roleId: r.id, bullets: r.bullets.map((b) => ({ text: b.text, sources: [b.id] })) })),
  achievements: BASE.achievements.map((a) => ({ title: a.title, text: a.text, sources: [a.id] })),
  skills: BASE.skills,
  emphasis: "",
  gaps: [],
};
for (const layout of ["designed", "ats"] as const) {
  writeFileSync(path.join(out, `sample-${layout}.pdf`), await renderPdf(toRenderable(t, BASE), layout));
}
console.log("wrote", out);
