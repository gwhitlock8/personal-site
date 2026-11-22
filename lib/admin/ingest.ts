import { classifyEmail, type Classification, type Classifier } from "./classify";
import { isForwardMove, matchEmail } from "./matching";
import {
  addEvent,
  getItem,
  linkThread,
  listItems,
  listProposals,
  markSeen,
  newId,
  saveItem,
  saveProposal,
  threadItem,
  wasSeen,
} from "./repo";
import { isStage, type Application, type EmailRef, type Item, type Stage } from "./pipeline";

// What happens to one email from the Gmail script:
// 1. Already processed: skip.
// 2. Its thread already belongs to an item: log an Event there (and maybe propose a Stage).
// 3. Outgoing mail outside tracked threads: ignore.
// 4. Otherwise classify it, then match it to an item:
//    one match      -> log an Event, maybe propose a Stage
//    several        -> propose "attach to which one?"
//    none           -> a confirmation creates an Application (agreed rule);
//                      anything else job-related proposes a new Opportunity.
// Stage changes are always proposals; Gavin approves them.

export type IngestOutcome = "duplicate" | "ignored" | "attached" | "created-application" | "proposed" | "error";

const suggested = (c: Classification): Stage | undefined => (c.stage !== "none" && isStage(c.stage) ? c.stage : undefined);

/** Proposes a Stage change if it moves forward and isn't already pending. */
export async function proposeStage(item: Item, email: EmailRef, stage: Stage | undefined, reason: string) {
  if (item.kind !== "application" || !stage || !isForwardMove(item.stage, stage)) return false;
  const pending = await listProposals();
  if (pending.some((p) => p.kind === "stage" && p.itemId === item.id && p.stage === stage)) return false;
  await saveProposal({
    id: newId(),
    createdAt: new Date().toISOString(),
    kind: "stage",
    itemId: item.id,
    stage,
    email,
    reason,
  });
  return true;
}

const proposeStageIfNeeded = (item: Item, email: EmailRef, c: Classification) =>
  proposeStage(item, email, suggested(c), c.summary || email.subject);

/** Logs an email as an Event on an item and ties its thread to that item. */
export async function logEmail(item: Item, email: EmailRef, summary: string) {
  await addEvent(item, email.direction === "out" ? "email-sent" : "email-received", summary, email.link, new Date(email.date));
  await linkThread(email.threadId, item.id);
}

export async function ingestEmail(email: EmailRef, classify: Classifier = classifyEmail): Promise<IngestOutcome> {
  if (await wasSeen(email.messageId)) return "duplicate";

  // A thread we already track.
  const tiedId = await threadItem(email.threadId);
  const tied = tiedId ? await getItem(tiedId) : null;
  if (tied) {
    if (email.direction === "out") {
      await logEmail(tied, email, `You sent: ${email.subject}`);
      await markSeen(email.messageId);
      return "attached";
    }
    const c = await classify(email);
    await logEmail(tied, email, c.summary || email.subject);
    const proposed = await proposeStageIfNeeded(tied, email, c);
    await markSeen(email.messageId);
    return proposed ? "proposed" : "attached";
  }

  if (email.direction === "out") {
    await markSeen(email.messageId);
    return "ignored";
  }

  const c = await classify(email);
  if (c.category === "not-job-related") {
    await markSeen(email.messageId);
    return "ignored";
  }

  const match = matchEmail(await listItems(), { company: c.company, role: c.role, fromAddress: email.from });
  const now = new Date().toISOString();
  let outcome: IngestOutcome;

  if (match.type === "match") {
    await logEmail(match.item, email, c.summary || email.subject);
    outcome = (await proposeStageIfNeeded(match.item, email, c)) ? "proposed" : "attached";
  } else if (match.type === "ambiguous") {
    await saveProposal({
      id: newId(),
      createdAt: now,
      kind: "attach",
      email,
      candidateIds: match.candidates.map((i) => i.id),
      suggestedStage: suggested(c),
      company: c.company,
      role: c.role,
      reason: c.summary || email.subject,
    });
    outcome = "proposed";
  } else if (c.category === "application-confirmation" && c.company && c.role) {
    const app: Application = {
      id: newId(),
      kind: "application",
      company: c.company.slice(0, 120),
      role: c.role.slice(0, 160),
      stage: "Applied",
      appliedOn: email.date.slice(0, 10),
      source: "email",
      createdAt: now,
      updatedAt: now,
      lastEventAt: email.date,
    };
    await saveItem(app);
    await addEvent(app, "created", `Applied (from a confirmation email): ${c.summary || email.subject}`, email.link, new Date(email.date));
    await linkThread(email.threadId, app.id);
    outcome = "created-application";
  } else {
    await saveProposal({
      id: newId(),
      createdAt: now,
      kind: "new-opportunity",
      email,
      company: c.company,
      role: c.role,
      suggestedStage: suggested(c),
      reason: c.summary || email.subject,
    });
    outcome = "proposed";
  }

  await markSeen(email.messageId);
  return outcome;
}
