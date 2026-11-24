import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listJobs } from "@/lib/admin/job-scan";
import { listProposals } from "@/lib/admin/repo";
import { logoutAction } from "../actions";

export const metadata: Metadata = { title: "Admin | Gavin Whitlock", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [proposals, jobs] = await Promise.all([listProposals(), listJobs()]);
  const pending = proposals.length;
  const newJobs = jobs.filter((j) => j.status === "new" && !j.closedAt).length;
  return (
    <div className="mx-auto max-w-[90rem] px-5 sm:px-8">
      <header className="flex items-center justify-between border-b border-line py-4">
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/admin" className="font-semibold">
            Job search
          </Link>
          <Link href="/admin" className="text-slate hover:text-ink">
            Pipeline
          </Link>
          <Link href="/admin/review" className="text-slate hover:text-ink">
            Review
            {pending > 0 && (
              <span className="ml-1.5 rounded-full bg-cobalt px-1.5 py-0.5 text-[11px] font-semibold text-white">{pending}</span>
            )}
          </Link>
          <Link href="/admin/jobs" className="text-slate hover:text-ink">
            Jobs
            {newJobs > 0 && <span className="ml-1.5 rounded-full bg-line px-1.5 py-0.5 text-[11px] font-semibold text-ink">{newJobs}</span>}
          </Link>
          <Link href="/admin/watchlist" className="text-slate hover:text-ink">
            Watchlist
          </Link>
          <Link href="/admin/experience" className="text-slate hover:text-ink">
            Experience
          </Link>
          <Link href="/admin/new" className="text-slate hover:text-ink">
            Add
          </Link>
        </nav>
        <form action={logoutAction}>
          <button className="text-sm text-slate hover:text-ink">Log out</button>
        </form>
      </header>
      <main className="py-8">{children}</main>
    </div>
  );
}
