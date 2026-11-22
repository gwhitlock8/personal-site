import type { Item, Stage } from "./pipeline";
import { ACTIVE_STAGES } from "./pipeline";

// Deciding which Application or Opportunity an email belongs to. Pure functions.
//
// Rule (agreed): match on the Gmail thread, or on the sender's company domain
// plus the role. If more than one item could match, ask Gavin instead of
// guessing; a wrong match silently moves the wrong Application.

/** Applicant tracking systems send mail on a company's behalf, so their domain says nothing about the company. */
export const ATS_DOMAINS = [
  "ashbyhq.com",
  "greenhouse.io",
  "greenhouse-mail.io",
  "lever.co",
  "myworkday.com",
  "myworkdayjobs.com",
  "workday.com",
  "smartrecruiters.com",
  "icims.com",
  "jobvite.com",
  "workablemail.com",
  "workable.com",
  "rippling.com",
  "rippling-ats.com",
  "bamboohr.com",
  "dover.com",
  "gem.com",
  "pinpointhq.com",
  "breezy.hr",
  "teamtailor.com",
  "recruitee.com",
  "jazzhr.com",
  "linkedin.com",
];

const PERSONAL_DOMAINS = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "me.com", "proton.me", "protonmail.com"];

const endsWithDomain = (domain: string, list: string[]) => list.some((d) => domain === d || domain.endsWith(`.${d}`));
export const isAtsDomain = (domain: string) => endsWithDomain(domain, ATS_DOMAINS);
export const isPersonalDomain = (domain: string) => endsWithDomain(domain, PERSONAL_DOMAINS);

/** "Jane Doe <jane@mail.rox.com>" -> "mail.rox.com" */
export function emailDomain(address: string): string {
  const email = address.match(/<([^>]+)>/)?.[1] ?? address;
  return email.split("@")[1]?.trim().toLowerCase().replace(/>$/, "") ?? "";
}

/** "mail.rox.com" -> "rox"; the label most likely to match a company name. */
export function domainLabel(domain: string): string {
  const parts = domain.split(".").filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  const secondLevel = ["co", "com", "org", "net", "ac", "gov"];
  const i = parts.length >= 3 && secondLevel.includes(parts[parts.length - 2]) ? parts.length - 3 : parts.length - 2;
  return parts[i];
}

const DROP = new Set(["inc", "llc", "ltd", "corp", "corporation", "co", "company", "the", "hq", "gmbh", "plc"]);

/** "Rox Data Corp." -> "roxdata"; used to compare company names loosely. */
export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !DROP.has(w))
    .join("");
}

/** Companies match if their normalized names are equal or one starts with the other ("rox" vs "roxdata"), min 3 chars. */
export function companiesMatch(a: string, b: string): boolean {
  const x = normalizeCompany(a);
  const y = normalizeCompany(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 3 && long.startsWith(short);
}

const ROLE_STOP = new Set(["the", "a", "an", "of", "and", "for", "to", "in", "at", "remote", "hybrid", "us", "usa"]);
const roleTokens = (s: string) =>
  new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !ROLE_STOP.has(t)));

/** Share of the shorter title's words that appear in the other (0..1). */
export function roleSimilarity(a: string, b: string): number {
  const x = roleTokens(a);
  const y = roleTokens(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const t of x) if (y.has(t)) shared++;
  return shared / Math.min(x.size, y.size);
}

/** Domains tied to an item: its contact's email domain and its posting URL host (unless that's an ATS). */
function itemDomains(item: Item): string[] {
  const out: string[] = [];
  if (item.kind === "opportunity" && item.contact?.includes("@")) out.push(emailDomain(item.contact));
  if (item.url) {
    try {
      const host = new URL(item.url).hostname.replace(/^www\./, "");
      if (!isAtsDomain(host)) out.push(host);
    } catch {
      /* not a URL */
    }
  }
  return out.filter((d) => d && !isPersonalDomain(d));
}

export type MatchInput = { company: string; role: string; fromAddress: string };
export type MatchResult =
  | { type: "match"; item: Item }
  | { type: "ambiguous"; candidates: Item[] }
  | { type: "none" };

/** Items still worth attaching mail to: everything except declined Opportunities. */
const attachable = (i: Item) => !(i.kind === "opportunity" && i.status === "declined");

export function matchEmail(items: Item[], input: MatchInput): MatchResult {
  const domain = emailDomain(input.fromAddress);
  const usefulDomain = domain && !isAtsDomain(domain) && !isPersonalDomain(domain) ? domain : "";
  const label = usefulDomain ? domainLabel(usefulDomain) : "";

  let candidates = items.filter(attachable).filter((item) => {
    if (input.company && companiesMatch(item.company, input.company)) return true;
    if (usefulDomain) {
      if (itemDomains(item).some((d) => d === usefulDomain || d.endsWith(`.${usefulDomain}`) || usefulDomain.endsWith(`.${d}`))) return true;
      if (label.length >= 3 && companiesMatch(item.company, label)) return true;
    }
    return false;
  });

  // A pursued Opportunity hands its mail to the Application it became.
  const pursuedIds = new Set(
    candidates.flatMap((c) => (c.kind === "opportunity" && c.applicationId ? [c.id] : [])),
  );
  candidates = candidates.filter((c) => !pursuedIds.has(c.id));

  if (candidates.length === 0) return { type: "none" };
  if (candidates.length === 1) return { type: "match", item: candidates[0] };

  if (input.role) {
    const scored = candidates.map((c) => ({ c, s: roleSimilarity(c.role, input.role) })).filter((x) => x.s >= 0.6);
    const best = Math.max(0, ...scored.map((x) => x.s));
    const top = scored.filter((x) => x.s === best);
    if (top.length === 1) return { type: "match", item: top[0].c };
  }
  return { type: "ambiguous", candidates };
}

/**
 * Whether a suggested Stage is worth proposing: only moves forward through the
 * active Stages, or to an end state. Never proposes moving backward.
 */
export function isForwardMove(current: Stage, next: Stage): boolean {
  if (current === next) return false;
  const order = ACTIVE_STAGES as readonly string[];
  const ci = order.indexOf(current);
  const ni = order.indexOf(next);
  if (ni === -1) return ci !== -1; // to an end state, from an active one
  if (ci === -1) return false; // already closed
  return ni > ci;
}
