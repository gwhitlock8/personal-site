import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createApplication, createOpportunity } from "../../actions";
import { button, field, label, RESUME_VERSIONS } from "../ui";

type Props = { searchParams: Promise<{ type?: string; error?: string }> };

export default async function NewItem({ searchParams }: Props) {
  await requireAdmin();
  const { type, error } = await searchParams;
  const isOpp = type === "opportunity";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl">
      <div className="flex gap-1 text-sm">
        <Link href="/admin/new" className={`rounded-md px-3 py-1.5 ${!isOpp ? "bg-cobalt-soft font-medium text-cobalt-deep" : "text-slate hover:text-ink"}`}>
          Application
        </Link>
        <Link
          href="/admin/new?type=opportunity"
          className={`rounded-md px-3 py-1.5 ${isOpp ? "bg-cobalt-soft font-medium text-cobalt-deep" : "text-slate hover:text-ink"}`}
        >
          Opportunity
        </Link>
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{isOpp ? "Add an Opportunity" : "Add an Application"}</h1>
      <p className="mt-1 text-sm text-slate">
        {isOpp
          ? "A role a recruiter or company raised with you before you applied."
          : "A role you've applied to. If you paste the job description, a Fit Check runs automatically."}
      </p>
      {error === "missing" && <p className="mt-3 text-sm text-red-700">Company and role are required.</p>}

      <form action={isOpp ? createOpportunity : createApplication} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Company
          <input name="company" required className={field} />
        </label>
        <label className={label}>
          Role
          <input name="role" required className={field} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Posting URL
          <input name="url" type="url" className={field} />
        </label>

        {isOpp ? (
          <label className={`${label} sm:col-span-2`}>
            Contact (recruiter name or email)
            <input name="contact" className={field} />
          </label>
        ) : (
          <>
            <label className={label}>
              Location
              <input name="location" placeholder="Austin (hybrid), Remote…" className={field} />
            </label>
            <label className={label}>
              Applied on
              <input name="appliedOn" type="date" defaultValue={today} className={field} />
            </label>
            <label className={`${label} sm:col-span-2`}>
              Resume version
              <input name="resumeVersion" list="resume-versions" className={field} />
              <datalist id="resume-versions">
                {RESUME_VERSIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>
            <label className={`${label} sm:col-span-2`}>
              Job description
              <textarea name="jobDescription" rows={8} className={field} />
            </label>
          </>
        )}

        <label className={`${label} sm:col-span-2`}>
          Notes
          <textarea name="notes" rows={3} className={field} />
        </label>
        <div className="sm:col-span-2">
          <button className={button}>{isOpp ? "Add Opportunity" : "Add Application"}</button>
        </div>
      </form>
    </div>
  );
}
