import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { logoutAction } from "../actions";

export const metadata: Metadata = { title: "Admin | Gavin Whitlock", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
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
