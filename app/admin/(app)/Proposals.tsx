import Link from "next/link";
import type { Item, ProposedChange } from "@/lib/admin/pipeline";
import { approveProposal, dismissProposal } from "../actions";
import { button, field, formatDate, ghost } from "./ui";

// Proposed Changes waiting for Gavin's approval. Used on the Review page and on
// each Application page.

const TITLE: Record<ProposedChange["kind"], string> = {
  stage: "Stage change",
  attach: "Which item is this email about?",
  "new-opportunity": "New Opportunity",
};

export default function Proposals({ proposals, items }: { proposals: ProposedChange[]; items: Map<string, Item> }) {
  if (proposals.length === 0) return null;
  return (
    <ul className="space-y-3">
      {proposals.map((p) => (
        <li key={p.id}>
          <ProposalCard p={p} items={items} />
        </li>
      ))}
    </ul>
  );
}

function ProposalCard({ p, items }: { p: ProposedChange; items: Map<string, Item> }) {
  const item = p.itemId ? items.get(p.itemId) : undefined;
  const approve = approveProposal.bind(null, p.id);
  const dismiss = dismissProposal.bind(null, p.id);

  return (
    <div className="rounded-lg border border-cobalt/30 bg-card p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-cobalt-deep">{TITLE[p.kind]}</p>

      {p.kind === "stage" && (
        <p className="mt-1.5 text-[15px]">
          Move{" "}
          {item ? (
            <Link href={`/admin/items/${item.id}`} className="font-medium underline underline-offset-2">
              {item.company} · {item.role}
            </Link>
          ) : (
            "a deleted item"
          )}{" "}
          {item?.kind === "application" && <>from {item.stage} </>}to <span className="font-medium">{p.stage}</span>
        </p>
      )}
      {p.kind !== "stage" && (
        <p className="mt-1.5 text-[15px]">
          {p.company || "Unknown company"}
          {p.role && <span className="text-slate"> · {p.role}</span>}
        </p>
      )}

      <div className="mt-3 rounded-md bg-paper px-3 py-2 text-[13px]">
        <p className="text-slate">
          {p.email.direction === "out" ? "You sent" : p.email.from} · {formatDate(p.email.date)}
        </p>
        <p className="mt-0.5 font-medium">{p.email.subject}</p>
        <p className="mt-1 text-ink/80">{p.reason}</p>
        <a href={p.email.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-cobalt underline underline-offset-2">
          Open in Gmail
        </a>
      </div>

      <form action={approve} className="mt-3 space-y-2">
        {p.kind === "attach" && (
          <fieldset className="space-y-1.5 text-[14px]">
            {(p.candidateIds ?? []).map((cid) => {
              const c = items.get(cid);
              if (!c) return null;
              return (
                <label key={cid} className="flex items-center gap-2">
                  <input type="radio" name="itemId" value={cid} required />
                  {c.company} · {c.role}{" "}
                  <span className="text-slate">({c.kind === "application" ? c.stage : "Opportunity"})</span>
                </label>
              );
            })}
          </fieldset>
        )}
        {p.kind === "new-opportunity" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="company" defaultValue={p.company} placeholder="Company" required aria-label="Company" className={`${field} mt-0`} />
            <input name="role" defaultValue={p.role} placeholder="Role" required aria-label="Role" className={`${field} mt-0`} />
          </div>
        )}
        <div className="flex gap-2">
          <button className={button} disabled={p.kind === "stage" && !item}>
            {p.kind === "new-opportunity" ? "Create Opportunity" : p.kind === "attach" ? "Attach" : "Approve"}
          </button>
          <button formAction={dismiss} formNoValidate className={ghost}>
            Dismiss
          </button>
        </div>
      </form>
    </div>
  );
}
