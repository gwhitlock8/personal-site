// Rebuilds the downloadable general resume (public/Gavin-Whitlock-Resume.pdf)
// from lib/resume/base.ts, in the designed one-page layout.
//   npx tsx scripts/build-resume-pdf.ts

import { writeFileSync } from "node:fs";
import { BASE } from "../lib/resume/base";
import { fitToOnePage, pageCount } from "../lib/resume/pdf/render";
import type { TailoredResume } from "../lib/resume/generate";

const general: TailoredResume = {
  tagline: BASE.tagline,
  summary: { text: BASE.summary.text, sources: [BASE.summary.id] },
  roles: BASE.roles.map((r) => ({ roleId: r.id, bullets: r.bullets.map((b, i) => ({ text: b.text, sources: [b.id], priority: i + 1 })) })),
  achievements: BASE.achievements.map((a) => ({ title: a.title, text: a.text, sources: [a.id] })),
  skills: BASE.skills,
  emphasis: "",
  gaps: [],
};

const fit = await fitToOnePage(general, BASE);
if (fit.tooLong || pageCount(fit.designed) !== 1) throw new Error("The general resume doesn't fit on one page.");
writeFileSync("public/Gavin-Whitlock-Resume.pdf", fit.designed);
console.log(`Wrote public/Gavin-Whitlock-Resume.pdf (${fit.designed.length} bytes, 1 page)`);
