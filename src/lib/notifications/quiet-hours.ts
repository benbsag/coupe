import { DateTime } from "luxon";

/**
 * §4.2: hold anything scheduled between 22:00 and 07:30 in the recipient's
 * timezone until 07:30. No exception — nothing here is urgent enough to
 * override it.
 */
export function applyQuietHours(date: Date, timezone: string): Date {
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  const morningThreshold = dt.set({ hour: 7, minute: 30, second: 0, millisecond: 0 });
  const nightThreshold = dt.set({ hour: 22, minute: 0, second: 0, millisecond: 0 });

  if (dt >= nightThreshold) {
    return morningThreshold.plus({ days: 1 }).toJSDate();
  }
  if (dt < morningThreshold) {
    return morningThreshold.toJSDate();
  }
  return date;
}
