import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { TailoredResume } from "../generate";
import type { BaseResume } from "../types";
import { Ats } from "./Ats";
import { Designed } from "./Designed";
import { registerFonts } from "./fonts";
import type { RenderResume } from "./types";

export type { RenderResume };

export function toRenderable(t: TailoredResume, base: BaseResume): RenderResume {
  const lines = new Map(t.roles.map((r) => [r.roleId, r.bullets.map((b) => b.text)]));
  return {
    name: base.name,
    contact: base.contact,
    tagline: t.tagline,
    summary: t.summary.text,
    roles: base.roles.map((r) => ({ title: r.title, company: r.company, location: r.location, dates: r.dates, bullets: lines.get(r.id) ?? [] })),
    earlier: base.earlier,
    achievements: t.achievements.map((a) => ({ title: a.title, text: a.text })),
    education: base.education,
    skills: t.skills,
    certifications: t.certifications,
  };
}

export async function renderPdf(r: RenderResume, layout: "designed" | "ats"): Promise<Buffer> {
  registerFonts();
  // createElement keeps this file free of JSX; the templates are components.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = createElement(layout === "designed" ? Designed : Ats, { r }) as any;
  return renderToBuffer(doc);
}

/** Number of pages: /Type /Page objects, not the /Pages tree node. */
export function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

const MAX_TRIMS = 30;

/**
 * Renders both layouts, dropping the lowest-priority bullet (highest priority
 * number; never a role's last bullet) until the designed PDF fits one page.
 * Dropped lines are listed in `cut` so Gavin can swap one back in.
 */
export type Fitted = { resume: TailoredResume; designed: Buffer; ats: Buffer; tooLong: boolean; atsPages: number };

export async function fitToOnePage(t: TailoredResume, base: BaseResume): Promise<Fitted> {
  const resume: TailoredResume = structuredClone(t);
  resume.cut = [...(t.cut ?? [])];
  let designed = await renderPdf(toRenderable(resume, base), "designed");
  // If it overflows even with one bullet per role, the summary, achievements or
  // skills are too long: cutting experience bullets can't fix it, so don't.
  if (pageCount(designed) > 1) {
    const minimal: TailoredResume = { ...resume, roles: resume.roles.map((r) => ({ ...r, bullets: r.bullets.slice(0, 1) })) };
    if (pageCount(await renderPdf(toRenderable(minimal, base), "designed")) > 1) {
      const ats = await renderPdf(toRenderable(resume, base), "ats");
      return { resume, designed, ats, tooLong: true, atsPages: pageCount(ats) };
    }
  }
  for (let i = 0; i < MAX_TRIMS && pageCount(designed) > 1; i++) {
    let pick: { role: number; bullet: number; priority: number } | null = null;
    resume.roles.forEach((role, ri) => {
      if (role.bullets.length < 2) return;
      role.bullets.forEach((b, bi) => {
        const p = b.priority ?? bi + 1;
        if (!pick || p > pick.priority || (p === pick.priority && ri >= pick.role)) pick = { role: ri, bullet: bi, priority: p };
      });
    });
    if (!pick) break;
    const { role, bullet } = pick as { role: number; bullet: number };
    const [removed] = resume.roles[role].bullets.splice(bullet, 1);
    resume.cut.push(removed.text);
    designed = await renderPdf(toRenderable(resume, base), "designed");
  }
  const ats = await renderPdf(toRenderable(resume, base), "ats");
  return { resume, designed, ats, tooLong: pageCount(designed) > 1, atsPages: pageCount(ats) };
}
