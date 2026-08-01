import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bets, notifications, positions, users } from "@/db/schema";
import { applyQuietHours } from "./quiet-hours";

// One month, expressed in days, ahead of a fixed-date bet's deadline.
const REMINDER_LEAD_DAYS = 30;

/**
 * Schedules the single pre-deadline reminder for a just-locked bet: for
 * FIXED_DATE bets only, one email to each party one month before the
 * resolution date. Event-triggered and contingent bets have no fixed
 * deadline to count down to, so they get no reminder. If the bet locks
 * within a month of its deadline, the reminder is simply skipped (never
 * backfilled to fire immediately).
 */
export async function scheduleThresholdNotifications(betId: string): Promise<void> {
  const [bet] = await db.select().from(bets).where(eq(bets.id, betId));
  if (!bet || !bet.lockedAt) return;
  if (bet.kind !== "FIXED_DATE" || !bet.resolutionDate) return;

  const reminderAt = new Date(
    bet.resolutionDate.getTime() - REMINDER_LEAD_DAYS * 86_400_000
  );
  const now = new Date();
  if (reminderAt <= now) return;

  const betPositions = await db
    .select()
    .from(positions)
    .where(eq(positions.betId, betId));
  if (betPositions.length === 0) return;

  const recipients = await db
    .select()
    .from(users)
    .where(inArray(users.id, betPositions.map((p) => p.userId)));

  const rows: (typeof notifications.$inferInsert)[] = [];
  for (const recipient of recipients) {
    if (!recipient.notifyEmail) continue;
    rows.push({
      betId,
      userId: recipient.id,
      kind: "THRESHOLD",
      thresholdLabel: `${REMINDER_LEAD_DAYS}d`,
      channel: "email",
      scheduledFor: applyQuietHours(reminderAt, recipient.timezone),
      dedupeKey: `${betId}:THRESHOLD:${recipient.id}`,
    });
  }

  if (rows.length > 0) {
    await db.insert(notifications).values(rows).onConflictDoNothing();
  }
}

/** Cancels every not-yet-sent notification for a bet — used on resolution. */
export async function cancelAllPendingNotifications(betId: string): Promise<void> {
  await db
    .delete(notifications)
    .where(and(eq(notifications.betId, betId), isNull(notifications.sentAt)));
}

/**
 * Cancels only the unsent one-month reminder — used when an amendment
 * changes the resolution date (or kind) the reminder depends on, so the
 * schedule can be recomputed fresh against the new date.
 */
export async function cancelPendingThresholds(betId: string): Promise<void> {
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.betId, betId),
        isNull(notifications.sentAt),
        eq(notifications.kind, "THRESHOLD")
      )
    );
}
