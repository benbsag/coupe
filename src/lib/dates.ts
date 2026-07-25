import { DateTime } from "luxon";

export const ZURICH = "Europe/Zurich";

/**
 * Parses a "YYYY-MM-DD" calendar day and returns the UTC instant for
 * 23:59:59 Europe/Zurich on that day — the spec's fixed rule for "by
 * <date>" deadlines (§9). Returns null for anything not a real calendar
 * date; callers must fail loudly rather than coerce (e.g. 31 Sept).
 */
export function zurichEndOfDayToUtc(dateStr: string): Date | null {
  const dt = DateTime.fromISO(dateStr, { zone: ZURICH });
  if (!dt.isValid) return null;
  return dt
    .set({ hour: 23, minute: 59, second: 59, millisecond: 0 })
    .toUTC()
    .toJSDate();
}

export function formatZurich(date: Date | null | undefined): string {
  if (!date) return "—";
  return DateTime.fromJSDate(date, { zone: "utc" })
    .setZone(ZURICH)
    .toFormat("d LLL yyyy");
}
