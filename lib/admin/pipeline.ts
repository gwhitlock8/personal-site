import type { Fit } from "@/lib/chains";

// The job search domain. Terms match CONTEXT.md: Application, Opportunity,
// Stage, Event, Follow-up. Pure types and rules, no storage.

export const ACTIVE_STAGES = ["Applied", "Recruiter Screen", "Hiring Manager", "Technical", "Demo", "Final", "Offer"] as const;
export const END_STAGES = ["Rejected", "Withdrawn", "Accepted"] as const;
export const STAGES = [...ACTIVE_STAGES, ...END_STAGES] as const;
export type Stage = (typeof STAGES)[number];

const INTERVIEW_STAGES: readonly Stage[] = ["Recruiter Screen", "Hiring Manager", "Technical", "Demo", "Final"];

export const isStage = (s: string): s is Stage => (STAGES as readonly string[]).includes(s);
export const isEndStage = (s: Stage) => (END_STAGES as readonly string[]).includes(s);

type Common = {
  id: string;
  company: string;
  role: string;
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  /** Time of the most recent Event; any Event resets the follow-up clock. */
  lastEventAt: string;
};

export type Application = Common & {
  kind: "application";
  stage: Stage;
  location?: string;
  appliedOn: string; // YYYY-MM-DD
  resumeVersion?: string;
  jobDescription?: string;
  fit?: Fit;
  fitCheckedAt?: string;
  source: "manual" | "email" | "job-match" | "opportunity";
  opportunityId?: string;
};

export type Opportunity = Common & {
  kind: "opportunity";
  contact?: string;
  status: "open" | "pursued" | "declined";
  applicationId?: string;
};

export type Item = Application | Opportunity;

export type EventKind = "created" | "email-received" | "email-sent" | "note" | "stage-change";

export type EventRecord = {
  id: string;
  at: string;
  kind: EventKind;
  summary: string;
  link?: string;
};

// ---- Follow-up rules ----

export type FollowUp = { reason: string; suggestClose?: boolean };

const DAY = 86_400_000;

export function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY);
}

/** Whole weekdays elapsed after `from`, up to `to`. */
export function businessDaysBetween(from: Date, to: Date) {
  let count = 0;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/**
 * Whether an item needs Gavin to act, per the agreed rules:
 * Applied: 7 days without an Event (30 days: suggest closing).
 * Interview Stages: 4 business days without an Event.
 * Open Opportunity: 2 business days without an Event.
 */
export function followUp(item: Item, now = new Date()): FollowUp | null {
  const last = new Date(item.lastEventAt);
  if (item.kind === "opportunity") {
    if (item.status !== "open") return null;
    return businessDaysBetween(last, now) >= 2 ? { reason: "No reply in 2 business days. Respond or decline." } : null;
  }
  if (item.stage === "Applied") {
    const days = daysBetween(last, now);
    if (days >= 30) return { reason: "No activity in 30 days. Consider closing it.", suggestClose: true };
    if (days >= 7) return { reason: "No activity in 7 days. Find a referral or message the recruiter." };
    return null;
  }
  if (INTERVIEW_STAGES.includes(item.stage)) {
    return businessDaysBetween(last, now) >= 4 ? { reason: "4 business days since the last activity. Send a follow-up." } : null;
  }
  return null;
}
