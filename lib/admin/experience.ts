import { randomUUID } from "node:crypto";
import { adminDb } from "./db";

// The Experience bank: true details too much for the general resume. Used by
// tailored resumes and admin Fit Checks only, never the public assistant.
// Storage: one JSON array at `experience`, seeded on first read.

export type ExperienceEntry = {
  id: string;
  what: string;
  where: string;
  proof?: string;
  useWhen?: string;
  createdAt: string;
};

const KEY = "experience";
const SEEDED = "2026-11-24T00:00:00.000Z";

const seed = (id: string, what: string, where: string, useWhen?: string): ExperienceEntry => ({ id, what, where, ...(useWhen ? { useWhen } : {}), createdAt: SEEDED });

export const EXPERIENCE_SEED: ExperienceEntry[] = [
  seed("seed-csa", "Certified ServiceNow Administrator (CSA).", "certification", "ServiceNow-heavy roles or postings that mention the CMDB"),
  seed("seed-cmdb", "Navigated ServiceNow CSDM and the CMDB.", "ServiceNow"),
  seed(
    "seed-datasources",
    "Wrote custom DataSources in Groovy that used protocols like SNMP to pull specific metrics from infrastructure. They ran on the LogicMonitor Collector, a lightweight Java app installed on a host inside the customer's environment that polls network-connected devices.",
    "LogicMonitor",
  ),
  seed("seed-dashboards", "Built custom dashboards.", "LogicMonitor, ServiceNow and DevRev"),
  seed("seed-dashboard-skill", "Built an AI skill that creates accurate, useful dashboards using DevRev's internal API.", "DevRev"),
  seed("seed-api", "Troubleshot issues and worked out DevRev's API using Chrome DevTools and Postman.", "DevRev"),
];

export async function listExperience(): Promise<ExperienceEntry[]> {
  const raw = await adminDb().get(KEY);
  if (raw) return JSON.parse(raw) as ExperienceEntry[];
  await saveExperience(EXPERIENCE_SEED);
  return EXPERIENCE_SEED;
}

export async function saveExperience(entries: ExperienceEntry[]): Promise<void> {
  await adminDb().set(KEY, JSON.stringify(entries));
}

export async function addExperience(e: Omit<ExperienceEntry, "id" | "createdAt">): Promise<ExperienceEntry> {
  const entry: ExperienceEntry = { ...e, id: randomUUID(), createdAt: new Date().toISOString() };
  await saveExperience([...(await listExperience()), entry]);
  return entry;
}

/**
 * The id tailored drafts cite for an entry. Derived from the entry's own id, so
 * it doesn't shift when other entries are added or deleted ("seed-csa" -> "E-csa").
 */
export function experienceId(e: Pick<ExperienceEntry, "id">): string {
  const core = e.id.replace(/^seed-/, "").replace(/[^A-Za-z0-9]/g, "");
  return `E-${core.length > 16 ? core.slice(0, 8) : core}`; // random UUIDs get shortened
}

/** Markdown lines with each entry's id, for admin Fit Checks. */
export function experienceAsContext(entries: ExperienceEntry[]): string {
  return entries
    .map((e) => {
      const extra = [e.where, e.proof, e.useWhen ? `use when: ${e.useWhen}` : ""].filter(Boolean).join("; ");
      return `- [${experienceId(e)}] ${e.what}${extra ? ` (${extra})` : ""}`;
    })
    .join("\n");
}
