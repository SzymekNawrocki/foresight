import { Tooltip } from "./ui/tooltip.js";

// Pełny czas zawsze po polsku i w strefie Warszawy, niezależnie od przeglądarki.
const full = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Warsaw" });

/** "przed chwilą", "25 min temu", "3 h temu", "2 dni temu". */
export function relative(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "przed chwilą";
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h temu`;
  return `${Math.floor(hours / 24)} dni temu`;
}

/** A relative time; the full Warsaw time shows on hover and is read by screen readers. */
export function When({ iso }: { iso: string }) {
  const absolute = full.format(new Date(iso));
  return (
    <Tooltip render={<time dateTime={iso} className="data" />} content={absolute}>
      {relative(iso, new Date())}
      <span className="sr-only">{` (${absolute})`}</span>
    </Tooltip>
  );
}
