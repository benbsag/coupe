import { DateTime } from "luxon";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bets, notifications, positions, users } from "@/db/schema";
import { ladderThresholds } from "@/lib/notification-ladder";
import { gaugeTarget } from "@/lib/bet-display";
import { applyQuietHours } from "./quiet-hours";

interface ThresholdEntry {
  label: string;
  scheduledFor: Date;
}

function computeThresholdEntries(lockedAt: Date, target: Date): ThresholdEntry[] {
  const durationDays = (target.getTime() - lockedAt.getTime()) / 86_400_000;
  const days = ladderThresholds(durationDays);
  return days.map((d) => ({
    label: d === 0 ? "immediate" : `${d}d`,
    scheduledFor: new Date(target.getTime() - d * 86_400_000),
  }));
}

/**
 * §4.1: computes the ladder for a just-locked bet and inserts one
 * notification row per (threshold, recipient), plus the fixed 09:00
 * Europe/Zurich "deadline reached" notification for the day after target.
 * Thresholds already in the past at lock time are skipped, not backfilled.
 */
export async function scheduleThresholdNotifications(betId: string): Promise<void> {
  const [bet] = await db.select().from(bets).where(eq(bets.id, betId));
  if (!bet || !bet.lockedAt) return;
  const target = gaugeTarget(bet);
  if (!target) return;

  const now = new Date();
  const entries = computeThresholdEntries(bet.lockedAt, target).filter(
    (e) => e.scheduledFor > now
  );

  const deadlineReachedAt = DateTime.fromJSDate(target, { zone: "utc" })
    .setZone("Europe/Zurich")
    .plus({ days: 1 })
    .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();

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

    for (const entry of entries) {
      rows.push({
        betId,
        userId: recipient.id,
        kind: "THRESHOLD",
        thresholdLabel: entry.label,
        channel: "email",
        scheduledFor: applyQuietHours(entry.scheduledFor, recipient.timezone),
        dedupeKey: `${betId}:THRESHOLD:${entry.label}:${recipient.id}`,
      });
    }

    if (deadlineReachedAt > now) {
      rows.push({
        betId,
        userId: recipient.id,
        kind: "DEADLINE_REACHED",
        thresholdLabel: "deadline",
        channel: "email",
        scheduledFor: deadlineReachedAt,
        dedupeKey: `${betId}:DEADLINE_REACHED:${recipient.id}`,
      });
    }
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
 * Cancels only unsent threshold/deadline rows — used when an amendment
 * changes a date the ladder depends on, so schedule can be recomputed
 * fresh (§4.1: "recompute future thresholds and drop ones already sent").
 */
export async function cancelPendingThresholds(betId: string): Promise<void> {
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.betId, betId),
        isNull(notifications.sentAt),
        inArray(notifications.kind, ["THRESHOLD", "DEADLINE_REACHED"])
      )
    );
}
