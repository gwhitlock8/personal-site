import { ACTIVE_STAGES, followUp, type FollowUp, type Item, type ProposedChange } from "./pipeline";

// The weekday-morning Digest: follow-ups due, Proposed Changes to review, and a
// Pipeline summary. Pure: the Apps Script fetches it and sends it from Gmail.
// On a quiet day (nothing due, nothing to review) send is false and no email goes out.

export type Digest = {
  send: boolean;
  subject: string;
  text: string;
  html: string;
  counts: { followUps: number; proposals: number };
};

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Interview-stage follow-ups first, then Opportunities, then Applied, then "consider closing". */
function urgency(item: Item, f: FollowUp): number {
  if (f.suggestClose) return 3;
  if (item.kind === "opportunity") return 1;
  return item.stage === "Applied" ? 2 : 0;
}

function proposalLine(p: ProposedChange, items: Map<string, Item>): string {
  if (p.kind === "stage") {
    const item = p.itemId ? items.get(p.itemId) : undefined;
    const name = item ? `${item.company} · ${item.role}` : "An Application";
    return `${name}: move to ${p.stage}`;
  }
  if (p.kind === "new-opportunity") return `New Opportunity: ${p.company || "unknown company"}${p.role ? ` · ${p.role}` : ""}`;
  return `Which item is this email about? "${p.email.subject}"`;
}

export function buildDigest(items: Item[], proposals: ProposedChange[], baseUrl: string, now = new Date()): Digest {
  const base = baseUrl.replace(/\/$/, "");
  const byId = new Map(items.map((i) => [i.id, i]));
  const due = items
    .map((item) => ({ item, f: followUp(item, now) }))
    .filter((x): x is { item: Item; f: FollowUp } => x.f !== null)
    .sort((a, b) => urgency(a.item, a.f) - urgency(b.item, b.f) || a.item.lastEventAt.localeCompare(b.item.lastEventAt));

  const counts = { followUps: due.length, proposals: proposals.length };
  if (!due.length && !proposals.length) return { send: false, subject: "", text: "", html: "", counts };

  const parts: string[] = [];
  if (due.length) parts.push(plural(due.length, "follow-up", "follow-ups"));
  if (proposals.length) parts.push(plural(proposals.length, "change", "changes") + " to review");
  const subject = `Job search: ${parts.join(", ")}`;

  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" });
  const active = items.filter((i) => i.kind === "application" && (ACTIVE_STAGES as readonly string[]).includes(i.stage));
  const openOpps = items.filter((i) => i.kind === "opportunity" && i.status === "open").length;
  const byStage = ACTIVE_STAGES.map((s) => [s, active.filter((a) => a.kind === "application" && a.stage === s).length] as const).filter(([, n]) => n > 0);
  const summary = `${plural(active.length, "active Application", "active Applications")}${byStage.length ? ` (${byStage.map(([s, n]) => `${n} ${s}`).join(", ")})` : ""}, ${plural(openOpps, "open Opportunity", "open Opportunities")}.`;
  const itemUrl = (i: Item) => `${base}/admin/items/${i.id}`;
  const reviewUrl = `${base}/admin/review`;

  // Plain text
  const text: string[] = [`Job search, ${date}`, ""];
  if (due.length) {
    text.push(`FOLLOW-UPS DUE (${due.length})`);
    for (const { item, f } of due) text.push(`- ${item.company} · ${item.role}: ${f.reason}`, `  ${itemUrl(item)}`);
    text.push("");
  }
  if (proposals.length) {
    text.push(`TO REVIEW (${proposals.length})`);
    for (const p of proposals) text.push(`- ${proposalLine(p, byId)}`);
    text.push(`  ${reviewUrl}`, "");
  }
  text.push(`PIPELINE: ${summary}`, `${base}/admin`);

  // HTML (inline styles for email clients)
  const h: string[] = [];
  const link = "color:#1f3ea8;";
  h.push(`<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.45;color:#17202b;max-width:600px">`);
  h.push(`<p style="margin:0 0 16px;color:#5a6676">Job search, ${esc(date)}</p>`);
  if (due.length) {
    h.push(`<h2 style="font-size:15px;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:#5a6676">Follow-ups due (${due.length})</h2><ul style="padding-left:18px;margin:0">`);
    for (const { item, f } of due) {
      h.push(`<li style="margin:0 0 8px"><a href="${esc(itemUrl(item))}" style="${link}font-weight:600">${esc(item.company)} · ${esc(item.role)}</a><br>${esc(f.reason)}</li>`);
    }
    h.push(`</ul>`);
  }
  if (proposals.length) {
    h.push(`<h2 style="font-size:15px;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:#5a6676">To review (${proposals.length})</h2><ul style="padding-left:18px;margin:0">`);
    for (const p of proposals) h.push(`<li style="margin:0 0 6px">${esc(proposalLine(p, byId))}</li>`);
    h.push(`</ul><p style="margin:8px 0 0"><a href="${esc(reviewUrl)}" style="${link}">Open Review</a></p>`);
  }
  h.push(`<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #d5dbe2;color:#5a6676">Pipeline: ${esc(summary)} <a href="${esc(base)}/admin" style="${link}">Open the Pipeline</a></p></div>`);

  return { send: true, subject, text: text.join("\n"), html: h.join(""), counts };
}
