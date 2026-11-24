import type { SavedResume } from "@/lib/resume/store";
import { deleteSavedPdf } from "../../resume-actions";
import { formatDate } from "../ui";
import { ConfirmButton } from "./ConfirmButton";

const fileLink = (url: string, name: string) => `/api/admin/resume/file?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;

/** Saved tailored resumes with download links and Delete. */
export function SavedResumes({ ownerStr, saved, back }: { ownerStr: string; saved: SavedResume[]; back: string }) {
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {saved.map((s) => (
        <li key={s.id ?? s.at} className="flex flex-wrap items-center gap-x-2">
          <span>Tailored {formatDate(s.at)}:</span>
          <a className="underline underline-offset-2" href={fileLink(s.designedUrl, `${s.fileBase}.pdf`)}>
            Designed
          </a>
          <span>·</span>
          <a className="underline underline-offset-2" href={fileLink(s.atsUrl, `${s.fileBase}-ATS.pdf`)}>
            ATS
          </a>
          {s.id && (
            <form action={deleteSavedPdf.bind(null, ownerStr, s.id)} className="inline">
              <input type="hidden" name="back" value={back} />
              <ConfirmButton message="Delete both PDFs (designed and ATS) for this resume? This can't be undone." className="ml-2 text-slate hover:text-rose-700">
                Delete
              </ConfirmButton>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
