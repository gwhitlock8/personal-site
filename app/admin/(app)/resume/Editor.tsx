import Link from "next/link";
import { BASE } from "@/lib/resume/base";
import { blockedTerms, checkLine, untracedTerms, type Flag, type Line } from "@/lib/resume/checks";
import { MIN_POSTING, sourcesFor, type OwnerContext } from "@/lib/resume/context";
import { fitToOnePage, pageCount } from "@/lib/resume/pdf/render";
import { getResume } from "@/lib/resume/store";
import { addGapToBank, saveEdits, savePdf, tailor } from "../../resume-actions";
import { button, field, formatDate, ghost } from "../ui";

// The tailored resume editor, shared by Job Matches and Applications.

const ERRORS: Record<string, string> = {
  "rate-limit": "The model is busy this minute. Try again shortly.",
  "no-jd": "Paste the job description to tailor.",
  blob: "Add a Blob store in Vercel (Storage → Blob, access Private) to save PDFs.",
  generate: "Generating the draft failed. Try again.",
  bank: "Fill in the detail and where it's from.",
};

const FLAG_TONE: Record<Flag["kind"], string> = {
  blocked: "bg-rose-50 text-rose-900 ring-rose-200",
  "no-source": "bg-amber-50 text-amber-900 ring-amber-200",
  "unknown-source": "bg-amber-50 text-amber-900 ring-amber-200",
  number: "bg-amber-50 text-amber-900 ring-amber-200",
  copied: "bg-amber-50 text-amber-900 ring-amber-200",
};

function Flags({ flags }: { flags: Flag[] }) {
  if (!flags.length) return null;
  return (
    <ul className="mt-1 space-y-1">
      {flags.map((f, i) => (
        <li key={i} className={`rounded px-2 py-0.5 text-[12px] ring-1 ${FLAG_TONE[f.kind]}`}>
          {f.detail}
        </li>
      ))}
    </ul>
  );
}

function Chips({ ids, sources }: { ids: string[]; sources: Map<string, { text: string }> }) {
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <span key={id} title={sources.get(id)?.text.slice(0, 200) ?? "Unknown source"} className="cursor-help rounded bg-line/70 px-1.5 py-0.5 text-[11px] text-slate">
          {id}
        </span>
      ))}
    </span>
  );
}

export async function Editor({ ctx, sp }: { ctx: OwnerContext; sp: { error?: string; terms?: string; saved?: string; added?: string; layout?: string } }) {
  const record = await getResume(ctx.owner);
  const draft = record.draft;
  const layout = sp.layout === "ats" ? "ats" : "designed";
  const tooShort = ctx.posting.length < MIN_POSTING;

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <Link href={ctx.backUrl} className="text-sm text-slate hover:text-ink">
          ← {ctx.owner.kind === "job" ? "Job Matches" : "Application"}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Tailored resume</h1>
        <p className="text-sm text-slate">
          {ctx.company} · {ctx.title}
        </p>
      </div>
      {draft && !tooShort && (
        <form action={tailor.bind(null, ctx.ownerStr)}>
          <button className={ghost}>Regenerate</button>
        </form>
      )}
    </div>
  );

  const messages = (
    <>
      {sp.error === "blocked" && <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">Remove these before saving: {sp.terms}</p>}
      {sp.error && ERRORS[sp.error] && <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{ERRORS[sp.error]}</p>}
      {sp.saved && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Saved both PDFs. Download them below.</p>}
      {sp.added && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Added to the Experience bank. Regenerate to use it.</p>}
    </>
  );

  if (!draft) {
    return (
      <div className="max-w-3xl">
        {header}
        {messages}
        <div className="mt-6 rounded-lg border border-line bg-card p-5 text-sm">
          {tooShort ? (
            <p>
              {ERRORS["no-jd"]}{" "}
              {ctx.owner.kind === "job" ? "This posting has too little text; add the Application with its description, then tailor from there." : (
                <Link href={ctx.backUrl} className="underline underline-offset-2">
                  Add it under Details.
                </Link>
              )}
            </p>
          ) : (
            <form action={tailor.bind(null, ctx.ownerStr)} className="space-y-3">
              <p>Builds a one-page version from your resume, career stories, Experience bank{ctx.notes ? " and this Application's notes" : ""}. Every line cites where it came from.</p>
              <button className={button}>Tailor resume</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const sourceList = await sourcesFor(ctx);
  const sources = new Map(sourceList.map((s) => [s.id, s]));
  const termFlags = (text: string): Flag[] => {
    const flags: Flag[] = [];
    const untraced = untracedTerms(text, sourceList, BASE);
    if (untraced.length) flags.push({ kind: "no-source", detail: `Not found in your skills or sources: ${untraced.join(", ")}` });
    const blocked = blockedTerms(text);
    if (blocked.length) flags.push({ kind: "blocked", detail: `Remove before saving: ${blocked.join(", ")}` });
    return flags;
  };
  const flagsFor = (line: Line) => checkLine(line, sources, ctx.posting);
  const fitted = await fitToOnePage(draft, BASE);
  const pages = pageCount(fitted.designed);
  const preview = `/api/admin/resume/preview?owner=${encodeURIComponent(ctx.ownerStr)}&layout=${layout}&v=${Date.now()}`;

  return (
    <div>
      {header}
      {messages}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex items-center gap-3 text-sm">
            <Link href={ctx.editorUrl} className={layout === "designed" ? "font-medium" : "text-slate hover:text-ink"}>
              Designed
            </Link>
            <Link href={`${ctx.editorUrl}?layout=ats`} className={layout === "ats" ? "font-medium" : "text-slate hover:text-ink"}>
              ATS
            </Link>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[12px] ring-1 ${pages === 1 ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : "bg-rose-50 text-rose-900 ring-rose-200"}`}>
              {pages === 1 ? "Fits one page" : `${pages} pages`}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[12px] ring-1 ${fitted.atsPages === 1 ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>
              ATS: {fitted.atsPages} {fitted.atsPages === 1 ? "page" : "pages"}
            </span>
          </div>
          {fitted.tooLong && (
            <p className="mb-2 rounded-md bg-rose-50 px-3 py-2 text-[13px] text-rose-900">
              Too long for one page even with one bullet per role. Shorten the summary, achievements or skills.
            </p>
          )}
          <iframe src={preview} title="Resume preview" className="h-[80vh] w-full rounded-lg border border-line bg-white" />
          {(fitted.resume.cut ?? []).length > 0 && (
            <div className="mt-3 rounded-lg border border-line bg-card p-3 text-[13px]">
              <p className="font-medium">Cut to fit one page</p>
              <ul className="mt-1 list-disc pl-5 text-slate">
                {fitted.resume.cut!.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              <p className="mt-1 text-slate">To keep one, shorten or remove another line, or give it a lower order number.</p>
            </div>
          )}
        </div>

        <div>
          {draft.emphasis && <p className="rounded-lg bg-line/40 px-3 py-2 text-[13px] text-slate">{draft.emphasis}</p>}

          <form action={saveEdits.bind(null, ctx.ownerStr)} className="mt-4 space-y-5 text-sm">
            <input type="hidden" name="layout" value={layout} />
            <section>
              <label className="block font-medium">
                Tagline
                <input name="tagline" defaultValue={draft.tagline} className={field} />
              </label>
              <Flags flags={blockedTerms(draft.tagline, { allowTitle: false }).map((t) => ({ kind: "blocked" as const, detail: `Remove before saving: ${t}` }))} />
            </section>

            <section>
              <p className="font-medium">Summary</p>
              <textarea name="summary.text" defaultValue={draft.summary.text} rows={3} className={field} />
              <div className="mt-1 flex items-center gap-2">
                <Chips ids={draft.summary.sources} sources={sources} />
                <input name="summary.sources" defaultValue={draft.summary.sources.join(", ")} className="w-40 rounded border border-line px-1.5 py-0.5 text-[12px]" aria-label="Summary sources" />
              </div>
              <Flags flags={checkLine(draft.summary, sources, ctx.posting, { allowTitle: false })} />
            </section>

            {draft.roles.map((r) => {
              const role = BASE.roles.find((x) => x.id === r.roleId)!;
              return (
                <section key={r.roleId}>
                  <p className="font-medium">
                    {role.title}, {role.company} <span className="font-normal text-slate">{role.dates}</span>
                  </p>
                  {r.bullets.map((b, i) => (
                    <div key={i} className="mt-2 rounded-md border border-line bg-card p-2">
                      <div className="flex gap-2">
                        <input name={`role.${r.roleId}.${i}.order`} defaultValue={i + 1} className="w-10 rounded border border-line px-1 text-center text-[12px]" aria-label="Order" title="Order (1 = first, kept longest)" />
                        <textarea name={`role.${r.roleId}.${i}.text`} defaultValue={b.text} rows={2} className="w-full rounded border border-line px-2 py-1 text-[14px]" />
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Chips ids={b.sources} sources={sources} />
                        <input name={`role.${r.roleId}.${i}.sources`} defaultValue={b.sources.join(", ")} className="w-40 rounded border border-line px-1.5 py-0.5 text-[12px]" aria-label="Sources" />
                      </div>
                      <Flags flags={flagsFor(b)} />
                    </div>
                  ))}
                  <input name={`role.${r.roleId}.new`} placeholder="Add a bullet (true, in your words)" className="mt-2 w-full rounded border border-dashed border-line px-2 py-1 text-[13px]" />
                </section>
              );
            })}

            <section>
              <p className="font-medium">Key achievements</p>
              {draft.achievements.map((a, i) => (
                <div key={i} className="mt-2 rounded-md border border-line bg-card p-2">
                  <input name={`ach.${i}.title`} defaultValue={a.title} className="w-full rounded border border-line px-2 py-1 font-medium" aria-label="Achievement title" />
                  <textarea name={`ach.${i}.text`} defaultValue={a.text} rows={2} className="mt-1 w-full rounded border border-line px-2 py-1" />
                  <div className="mt-1 flex items-center gap-2">
                    <Chips ids={a.sources} sources={sources} />
                    <input name={`ach.${i}.sources`} defaultValue={a.sources.join(", ")} className="w-40 rounded border border-line px-1.5 py-0.5 text-[12px]" aria-label="Sources" />
                  </div>
                  <Flags flags={flagsFor({ text: `${a.title}: ${a.text}`, sources: a.sources })} />
                </div>
              ))}
            </section>

            <section>
              <p className="font-medium">Skills</p>
              {draft.skills.map((g, i) => (
                <div key={i} className="mt-2">
                  <div className="grid grid-cols-[8rem_1fr] gap-2">
                    <input name={`skills.${i}.group`} defaultValue={g.group} className="rounded border border-line px-2 py-1" aria-label="Skill group" />
                    <input name={`skills.${i}.items`} defaultValue={g.items} className="rounded border border-line px-2 py-1" aria-label="Skills" />
                  </div>
                  <Flags flags={termFlags(g.items)} />
                </div>
              ))}
              <label className="mt-3 block font-medium">
                Certifications <span className="font-normal text-slate">(optional)</span>
                <input name="certifications" defaultValue={draft.certifications ?? ""} className={field} />
              </label>
              {draft.certifications ? <Flags flags={termFlags(draft.certifications)} /> : null}
            </section>

            <div className="flex flex-wrap items-center gap-2">
              <button className={ghost}>Save edits</button>
              <button formAction={savePdf.bind(null, ctx.ownerStr)} className={button}>
                Save PDF
              </button>
              <span className="text-[13px] text-slate">Save PDF keeps your edits and stores the designed and ATS versions.</span>
            </div>
          </form>

          {draft.gaps.length > 0 && (
            <section className="mt-8">
              <p className="font-medium">Not covered by your material</p>
              <p className="text-[13px] text-slate">If one of these is true for you, add it to the Experience bank, then regenerate.</p>
              {draft.gaps.map((g, i) => (
                <form key={i} action={addGapToBank.bind(null, ctx.ownerStr)} className="mt-2 rounded-md border border-line bg-card p-2 text-sm">
                  <p className="font-medium">{g}</p>
                  <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
                    <input name="what" placeholder="What you did, in your words" className="rounded border border-line px-2 py-1" />
                    <input name="where" placeholder="Where (e.g. DevRev)" className="rounded border border-line px-2 py-1" />
                    <button className={ghost}>Add</button>
                  </div>
                </form>
              ))}
            </section>
          )}

          {record.saved.length > 0 && (
            <section className="mt-8">
              <p className="font-medium">Saved PDFs</p>
              <ul className="mt-2 space-y-1 text-sm">
                {record.saved.map((s) => (
                  <li key={s.at}>
                    {formatDate(s.at)}:{" "}
                    <a className="underline underline-offset-2" href={`/api/admin/resume/file?url=${encodeURIComponent(s.designedUrl)}&name=${encodeURIComponent(`${s.fileBase}.pdf`)}`}>
                      Designed
                    </a>{" "}
                    ·{" "}
                    <a className="underline underline-offset-2" href={`/api/admin/resume/file?url=${encodeURIComponent(s.atsUrl)}&name=${encodeURIComponent(`${s.fileBase}-ATS.pdf`)}`}>
                      ATS
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
