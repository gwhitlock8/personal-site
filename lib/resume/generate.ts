import { z } from "zod";
import type { Fit } from "@/lib/chains";
import { kimi } from "@/lib/model";
import { RateLimited } from "@/lib/admin/ingest";
import { takeModelBudget } from "@/lib/admin/repo";
import { BASE } from "./base";
import type { Line } from "./checks";
import { buildPrompt, RESUME_SYSTEM } from "./prompt";
import type { SourceRef } from "./sources";
import type { BaseResume, SkillGroup } from "./types";

// One Kimi call turns the posting and numbered sources into a draft. Fixed
// facts (titles, dates, companies) come from BASE in mergeDraft, never the model.

export type TailoredResume = {
  tagline: string;
  summary: Line;
  roles: { roleId: string; bullets: Line[] }[];
  achievements: { title: string; text: string; sources: string[] }[];
  skills: SkillGroup[];
  certifications?: string;
  emphasis: string;
  gaps: string[];
  cut?: string[];
};

const LineSchema = z.object({ text: z.string(), sources: z.array(z.string()) });

export const DraftSchema = z.object({
  tagline: z.string().describe('Only the focus after "Solutions Engineer | ".'),
  summary: LineSchema.describe("2-3 sentences."),
  roles: z.array(
    z.object({
      roleId: z.string(),
      bullets: z.array(LineSchema.extend({ priority: z.number().describe("1 = keep first; higher is cut first.") })),
    }),
  ),
  achievements: z.array(z.object({ title: z.string(), text: z.string(), sources: z.array(z.string()) })),
  skills: z.array(z.object({ group: z.string(), items: z.string() })),
  certifications: z.string().describe("Empty unless a source's use-when condition fits."),
  emphasis: z.string(),
  gaps: z.array(z.string()),
});
export type RawDraft = z.infer<typeof DraftSchema>;

const PREFIX = "Solutions Engineer | ";

export function mergeDraft(raw: RawDraft, base: BaseResume): TailoredResume {
  const byRole = new Map(raw.roles.map((r) => [r.roleId, r.bullets]));
  const focus = raw.tagline.trim().replace(/^solutions engineer\s*\|\s*/i, "") || base.tagline.slice(PREFIX.length);
  return {
    tagline: `${PREFIX}${focus}`,
    summary: { text: raw.summary.text.trim(), sources: raw.summary.sources },
    roles: base.roles.map((role) => {
      const bullets = (byRole.get(role.id) ?? []).filter((b) => b.text.trim()).slice(0, 5);
      return {
        roleId: role.id,
        bullets: bullets.length
          ? bullets.map((b) => ({ text: b.text.trim(), sources: b.sources, priority: b.priority }))
          : [{ text: role.bullets[0].text, sources: [role.bullets[0].id], priority: 1 }],
      };
    }),
    achievements: raw.achievements.slice(0, 4),
    skills: raw.skills.length ? raw.skills : base.skills,
    ...(raw.certifications.trim() ? { certifications: raw.certifications.trim() } : {}),
    emphasis: raw.emphasis,
    gaps: raw.gaps,
  };
}

/** Tailoring runs inside a 60-second Vercel function: one attempt, stopped well before the limit. */
export const TAILOR_MODEL = { timeoutMs: 45_000, maxRetries: 0 };

const kimiRun = async (prompt: string): Promise<unknown> => {
  const model = kimi(undefined, TAILOR_MODEL).withStructuredOutput(DraftSchema, { name: "tailored_resume", method: "jsonSchema", strict: true });
  return model.invoke([
    ["system", RESUME_SYSTEM],
    ["human", prompt],
  ]);
};

/** Throws RateLimited when this minute's model budget is used or Moonshot returns 429. */
export async function generateDraft(
  input: { posting: string; fit?: Fit; sources: SourceRef[] },
  run: (prompt: string) => Promise<unknown> = kimiRun,
): Promise<TailoredResume> {
  if (!(await takeModelBudget())) throw new RateLimited();
  let raw: unknown;
  try {
    raw = await run(buildPrompt({ ...input, base: BASE }));
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 429 || /\b429\b|rate limit|max RPM/i.test(String((err as Error)?.message))) throw new RateLimited();
    throw err;
  }
  return mergeDraft(DraftSchema.parse(raw), BASE);
}
