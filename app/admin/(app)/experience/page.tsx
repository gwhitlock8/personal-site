import { listExperience } from "@/lib/admin/experience";
import { addEntry, deleteEntry, updateEntry } from "../../experience-actions";
import { button, field, ghost, label } from "../ui";

const WHERE = ["DevRev", "ServiceNow", "LogicMonitor", "ClearDATA", "Earlier roles", "certification", "general"];

export default async function ExperiencePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const entries = await listExperience();
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Experience bank</h1>
      <p className="mt-1 text-sm text-slate">
        True details that are too much for the general resume. Tailored resumes and Fit Checks draw on these. They never appear on the public site.
      </p>
      {sp.error === "missing" && <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">Fill in what you did and where.</p>}

      <form action={addEntry} className="mt-6 space-y-3 rounded-lg border border-line bg-card p-4">
        <label className={label}>
          What you did
          <textarea name="what" required maxLength={600} rows={2} className={field} placeholder="One or two sentences, in your words" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            Where
            <input name="where" required maxLength={80} list="where-options" className={field} placeholder="DevRev" />
          </label>
          <label className={label}>
            Proof (optional)
            <input name="proof" maxLength={200} className={field} placeholder="A number or result" />
          </label>
          <label className={label}>
            Use when (optional)
            <input name="useWhen" maxLength={200} className={field} placeholder="e.g. ServiceNow-heavy roles" />
          </label>
        </div>
        <datalist id="where-options">
          {WHERE.map((w) => (
            <option key={w} value={w} />
          ))}
        </datalist>
        <button className={button}>Add</button>
      </form>

      <ul className="mt-6 space-y-3">
        {entries.map((e, i) => (
          <li key={e.id} className="rounded-lg border border-line bg-card p-4">
            <form action={updateEntry.bind(null, e.id)} className="space-y-2">
              <p className="text-[12px] font-semibold text-slate">E{i + 1}</p>
              <textarea name="what" defaultValue={e.what} required maxLength={600} rows={2} className={field} />
              <div className="grid gap-2 sm:grid-cols-3">
                <input name="where" defaultValue={e.where} required maxLength={80} list="where-options" className={field} aria-label="Where" />
                <input name="proof" defaultValue={e.proof ?? ""} maxLength={200} className={field} placeholder="Proof" aria-label="Proof" />
                <input name="useWhen" defaultValue={e.useWhen ?? ""} maxLength={200} className={field} placeholder="Use when" aria-label="Use when" />
              </div>
              <button className={ghost}>Save</button>
            </form>
            <form action={deleteEntry.bind(null, e.id)} className="mt-2">
              <button className="text-sm text-slate hover:text-rose-700">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
