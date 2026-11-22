// Small shared pieces for the admin screens.

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
