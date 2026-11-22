import { requireAdmin } from "@/lib/admin/auth";
import { listItems, listProposals } from "@/lib/admin/repo";
import Proposals from "../Proposals";

export default async function Review() {
  await requireAdmin();
  const [proposals, items] = await Promise.all([listProposals(), listItems()]);
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
      <p className="mt-1 text-sm text-slate">
        Changes suggested from your email. Nothing changes until you approve it.
      </p>
      <div className="mt-6">
        {proposals.length === 0 ? (
          <p className="text-slate">Nothing to review.</p>
        ) : (
          <Proposals proposals={proposals} items={new Map(items.map((i) => [i.id, i]))} />
        )}
      </div>
    </div>
  );
}
