import Link from "next/link";
import { listItems, listProposals } from "@/lib/admin/repo";
import { ACTIVE_STAGES, END_STAGES, followUp, type Application, type Item, type Opportunity } from "@/lib/admin/pipeline";
import { requireAdmin } from "@/lib/admin/auth";
import { ago, FollowUpBadge } from "./ui";

export default async function Pipeline() {
  await requireAdmin();
  const [items, proposals] = await Promise.all([listItems(), listProposals()]);
  const now = new Date();

  const apps = items.filter((i): i is Application => i.kind === "application");
  const openOpps = items.filter((i): i is Opportunity => i.kind === "opportunity" && i.status === "open");
  const closed = apps.filter((a) => (END_STAGES as readonly string[]).includes(a.stage));
  const due = items.filter((i) => followUp(i, now)).length;

  const columns: { title: string; items: Item[] }[] = [
    { title: "Opportunities", items: openOpps },
    ...ACTIVE_STAGES.map((s) => ({ title: s, items: apps.filter((a) => a.stage === s) })),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-sm text-slate">
            {apps.length - closed.length} active Applications · {openOpps.length} open Opportunities ·{" "}
            <span className={due ? "font-medium text-amber-800" : ""}>{due} follow-ups due</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/new" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/85">
            Add Application
          </Link>
          <Link href="/admin/new?type=opportunity" className="rounded-md border border-ink/25 bg-card px-4 py-2 text-sm font-medium hover:border-ink">
            Add Opportunity
          </Link>
        </div>
      </div>

      {proposals.length > 0 && (
        <Link
          href="/admin/review"
          className="mt-6 flex items-center justify-between rounded-lg border border-cobalt/30 bg-cobalt-soft px-4 py-3 text-sm text-cobalt-deep hover:border-cobalt"
        >
          <span>
            <span className="font-semibold">{proposals.length}</span> Proposed {proposals.length === 1 ? "Change" : "Changes"} from your email to review
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      {items.length === 0 ? (
        <p className="mt-10 max-w-lg text-slate">
          Nothing tracked yet. Add your current Applications by hand. Once the Gmail script is connected, new ones will
          appear here on their own.
        </p>
      ) : (
        <div className="mt-8 flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <section key={col.title} className="w-64 shrink-0">
              <h2 className="flex items-center justify-between text-[13px] font-semibold uppercase tracking-[0.06em] text-slate">
                {col.title}
                <span className="font-normal">{col.items.length}</span>
              </h2>
              <ul className="mt-3 space-y-2">
                {col.items.map((item) => {
                  const f = followUp(item, now);
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/admin/items/${item.id}`}
                        className={`block rounded-lg border bg-card p-3 hover:border-cobalt ${f ? "border-amber-300" : "border-line"}`}
                      >
                        <p className="font-medium leading-snug">{item.company}</p>
                        <p className="text-[13px] leading-snug text-ink/75">{item.role}</p>
                        <p className="mt-1.5 text-[12px] text-slate">Last activity {ago(item.lastEventAt, now)}</p>
                        {f && <FollowUpBadge reason={f.reason} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate">Closed ({closed.length})</h2>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-card">
            {closed.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/items/${a.id}`} className="flex justify-between gap-4 px-4 py-2.5 text-sm hover:bg-paper">
                  <span>
                    <span className="font-medium">{a.company}</span> · {a.role}
                  </span>
                  <span className="text-slate">{a.stage}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
