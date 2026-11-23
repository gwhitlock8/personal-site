import { getWatchlist } from "@/lib/admin/job-scan";
import { boardUrl } from "@/lib/admin/job-sources";
import { addCompany, removeCompany, toggleFde } from "../../job-actions";
import { button, field, label } from "../ui";

const ATS_NAME = { ashby: "Ashby", greenhouse: "Greenhouse", lever: "Lever" } as const;

export default async function WatchlistPage({ searchParams }: { searchParams: Promise<{ error?: string; tried?: string; added?: string; count?: string }> }) {
  const sp = await searchParams;
  const list = await getWatchlist();

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">Watchlist</h1>
      <p className="mt-1 text-sm text-slate">
        Companies whose job boards are scanned daily for Job Matches. {list.length} companies.
      </p>

      <form action={addCompany} className="mt-6 grid gap-3 rounded-lg border border-line bg-card p-4 sm:grid-cols-[1fr_1.6fr_auto] sm:items-end">
        <label className={label}>
          Company
          <input name="name" required maxLength={80} className={field} placeholder="Acme AI" />
        </label>
        <label className={label}>
          Job board URL
          <input name="board" required maxLength={300} className={field} placeholder="https://jobs.ashbyhq.com/acme" />
        </label>
        <button className={button}>Add</button>
        <p className="text-[12px] text-slate sm:col-span-3">
          Ashby, Greenhouse and Lever boards work. Or type just the board name and pick the system:{" "}
          <select name="ats" defaultValue="" className="rounded border border-line bg-card px-1 py-0.5">
            <option value="">from the URL</option>
            <option value="ashby">Ashby</option>
            <option value="greenhouse">Greenhouse</option>
            <option value="lever">Lever</option>
          </select>
          <label className="ml-4 inline-flex items-center gap-1.5">
            <input type="checkbox" name="fde" /> Forward Deployed roles here are presales
          </label>
        </p>
      </form>

      {sp.added && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Added {sp.added}: {sp.count} open roles on its board. It&apos;s included from the next scan.</p>}
      {sp.error === "input" && <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">Enter a company name and an Ashby, Greenhouse or Lever board URL.</p>}
      {sp.error === "duplicate" && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">That board is already on the Watchlist.</p>}
      {sp.error === "board" && (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">
          No job board found at {sp.tried}. Check the board name in the company&apos;s careers page URL.
        </p>
      )}

      <table className="mt-6 w-full text-sm">
        <thead className="text-left text-[12px] uppercase tracking-[0.06em] text-slate">
          <tr className="border-b border-line">
            <th className="py-2 font-semibold">Company</th>
            <th className="py-2 font-semibold">Board</th>
            <th className="py-2 font-semibold">FDE is presales</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.id} className="border-b border-line/70">
              <td className="py-2 font-medium">{c.name}</td>
              <td className="py-2">
                <a href={boardUrl(c)} target="_blank" rel="noopener noreferrer" className="text-slate hover:text-ink hover:underline">
                  {ATS_NAME[c.ats]} · {c.board}
                </a>
              </td>
              <td className="py-2">
                <form action={toggleFde.bind(null, c.id)}>
                  <button className="text-slate underline-offset-2 hover:text-ink hover:underline">{c.fdeIsPresales ? "Yes" : "No"}</button>
                </form>
              </td>
              <td className="py-2 text-right">
                <form action={removeCompany.bind(null, c.id)}>
                  <button className="text-slate hover:text-rose-700">Remove</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
