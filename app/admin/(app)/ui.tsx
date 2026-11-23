// Small shared pieces for the admin screens.

import type { Fit } from "@/lib/chains";

export const field =
  "mt-1 w-full rounded-md border border-line bg-card px-3 py-2 text-[15px] outline-none focus:border-slate";
export const label = "block text-sm font-medium";
export const button =
  "rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/85 disabled:opacity-50";
export const ghost = "rounded-md border border-ink/25 bg-card px-4 py-2 text-sm font-medium hover:border-ink";

export const RESUME_VERSIONS = ["General", "Rox"];

export function ago(iso: string, now = new Date()) {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
}

export function FollowUpBadge({ reason }: { reason: string }) {
  return (
    <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[12px] leading-snug text-amber-900 ring-1 ring-amber-200">
      {reason}
    </p>
  );
}

export function FitCard({ fit, checkedAt }: { fit: Fit; checkedAt?: string }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4 text-[14px]">
      <p className="font-medium">{fit.summary}</p>
      <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate">Matches</p>
      <ul className="mt-1 space-y-1.5">
        {fit.matches.map((m, i) => (
          <li key={i}>
            <span className="font-medium">{m.requirement}.</span> {m.evidence}
          </li>
        ))}
      </ul>
      {fit.gaps.length > 0 && (
        <>
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate">Gaps to prepare for</p>
          <ul className="mt-1 space-y-1.5">
            {fit.gaps.map((g, i) => (
              <li key={i}>
                <span className="font-medium">{g.requirement}.</span> {g.note}
              </li>
            ))}
          </ul>
        </>
      )}
      {checkedAt && <p className="mt-3 text-[12px] text-slate">Checked {formatDate(checkedAt)}</p>}
    </div>
  );
}
