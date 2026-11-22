import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getItem, listEvents } from "@/lib/admin/repo";
import { followUp, STAGES } from "@/lib/admin/pipeline";
import {
  addNote,
  changeStage,
  declineOpportunity,
  pursueOpportunity,
  removeItem,
  rerunFit,
  updateDetails,
} from "../../../actions";
import { button, field, FollowUpBadge, formatDate, ghost, label, RESUME_VERSIONS } from "../../ui";

type Props = { params: Promise<{ id: string }> };

const KIND_LABEL: Record<string, string> = {
  created: "Created",
  "email-received": "Email received",
  "email-sent": "Email sent",
  note: "Note",
  "stage-change": "Stage change",
};

export default async function ItemPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();
  const events = await listEvents(id);
  const f = followUp(item);
  const app = item.kind === "application" ? item : null;
  const opp = item.kind === "opportunity" ? item : null;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div>
        <Link href="/admin" className="text-sm text-slate hover:text-ink">
          ← Pipeline
        </Link>
        <p className="mt-4 text-[13px] uppercase tracking-[0.06em] text-slate">{app ? "Application" : "Opportunity"}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {item.company} <span className="font-normal text-slate">· {item.role}</span>
        </h1>
        <p className="mt-1 text-sm text-slate">
          {app && <>Applied {formatDate(`${app.appliedOn}T12:00:00Z`)} · </>}
          {opp && <>{opp.status === "open" ? "Open" : opp.status === "pursued" ? "Pursued" : "Declined"} · </>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Posting
            </a>
          )}
        </p>
        {f && <FollowUpBadge reason={f.reason} />}

        {app && (
          <form action={changeStage.bind(null, id)} className="mt-6 flex items-end gap-2">
            <label className={label}>
              Stage
              <select name="stage" defaultValue={app.stage} className={`${field} w-56`}>
                {STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <button className={ghost}>Update</button>
          </form>
        )}

        {opp?.status === "open" && (
          <div className="mt-6 flex gap-2">
            <form action={pursueOpportunity.bind(null, id)}>
              <button className={button}>Pursue (create Application)</button>
            </form>
            <form action={declineOpportunity.bind(null, id)}>
              <button className={ghost}>Decline</button>
            </form>
          </div>
        )}
        {opp?.applicationId && (
          <p className="mt-4 text-sm">
            <Link href={`/admin/items/${opp.applicationId}`} className="underline underline-offset-2">
              Go to the Application
            </Link>
          </p>
        )}

        <section className="mt-10">
          <h2 className="font-semibold">Timeline</h2>
          <form action={addNote.bind(null, id)} className="mt-3 flex gap-2">
            <input name="note" placeholder="Add a note (counts as activity)" className={`${field} mt-0`} />
            <button className={ghost}>Add</button>
          </form>
          <ol className="mt-4 space-y-3 border-l border-line pl-5">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-cobalt" aria-hidden />
                <p className="text-[12px] text-slate">
                  {KIND_LABEL[e.kind] ?? e.kind} · {formatDate(e.at)}
                </p>
                <p className="text-[15px]">
                  {e.summary}
                  {e.link && (
                    <>
                      {" "}
                      <a href={e.link} target="_blank" rel="noopener noreferrer" className="text-cobalt underline underline-offset-2">
                        Open in Gmail
                      </a>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {app && (
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Fit Check</h2>
              {app.jobDescription && app.jobDescription.length >= 200 && (
                <form action={rerunFit.bind(null, id)}>
                  <button className="text-sm text-slate underline underline-offset-2 hover:text-ink">
                    {app.fit ? "Run again" : "Run Fit Check"}
                  </button>
                </form>
              )}
            </div>
            {app.fit ? (
              <div className="mt-3 rounded-lg border border-line bg-card p-4 text-[14px]">
                <p className="font-medium">{app.fit.summary}</p>
                <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate">Matches</p>
                <ul className="mt-1 space-y-1.5">
                  {app.fit.matches.map((m, i) => (
                    <li key={i}>
                      <span className="font-medium">{m.requirement}.</span> {m.evidence}
                    </li>
                  ))}
                </ul>
                {app.fit.gaps.length > 0 && (
                  <>
                    <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate">Gaps to prepare for</p>
                    <ul className="mt-1 space-y-1.5">
                      {app.fit.gaps.map((g, i) => (
                        <li key={i}>
                          <span className="font-medium">{g.requirement}.</span> {g.note}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {app.fitCheckedAt && <p className="mt-3 text-[12px] text-slate">Checked {formatDate(app.fitCheckedAt)}</p>}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate">
                {app.jobDescription ? "No Fit Check yet." : "Paste the job description in Details to run a Fit Check."}
              </p>
            )}
          </section>
        )}
      </div>

      <aside className="space-y-8">
        <section>
          <h2 className="font-semibold">Details</h2>
          <form action={updateDetails.bind(null, id)} className="mt-3 space-y-3">
            <label className={label}>
              Company
              <input name="company" defaultValue={item.company} className={field} />
            </label>
            <label className={label}>
              Role
              <input name="role" defaultValue={item.role} className={field} />
            </label>
            <label className={label}>
              Posting URL
              <input name="url" type="url" defaultValue={item.url} className={field} />
            </label>
            {app && (
              <>
                <label className={label}>
                  Location
                  <input name="location" defaultValue={app.location} className={field} />
                </label>
                <label className={label}>
                  Resume version
                  <input name="resumeVersion" list="resume-versions" defaultValue={app.resumeVersion} className={field} />
                  <datalist id="resume-versions">
                    {RESUME_VERSIONS.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </label>
                <label className={label}>
                  Job description
                  <textarea name="jobDescription" rows={6} defaultValue={app.jobDescription} className={field} />
                </label>
              </>
            )}
            {opp && (
              <label className={label}>
                Contact
                <input name="contact" defaultValue={opp.contact} className={field} />
              </label>
            )}
            <label className={label}>
              Notes
              <textarea name="notes" rows={3} defaultValue={item.notes} className={field} />
            </label>
            <button className={button}>Save details</button>
          </form>
        </section>

        <section className="rounded-lg border border-red-200 p-4">
          <h2 className="text-sm font-semibold text-red-800">Delete</h2>
          <form action={removeItem.bind(null, id)} className="mt-2 space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="confirm" value="yes" required /> Delete this and its timeline permanently
            </label>
            <button className="rounded-md border border-red-300 px-3 py-1.5 text-red-800 hover:bg-red-50">Delete</button>
          </form>
        </section>
      </aside>
    </div>
  );
}
