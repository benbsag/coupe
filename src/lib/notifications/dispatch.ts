import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, settlements, users } from "@/db/schema";
import { sendMail } from "@/lib/email";
import {
  renderNotificationCopy,
  bottleLabel,
  type NotificationKind,
  type CopyPlaceholders,
} from "./copy";
import { applyQuietHours } from "./quiet-hours";

/**
 * §4.3: "{bottles} is computed per recipient — the count of settlement
 * rows between that pair." Not scoped to a single bet, so a pair who
 * already owe each other from a prior bet see the cumulative count.
 */
async function countBottlesBetween(debtorId: string, creditorId: string): Promise<number> {
  const rows = await db
    .select()
    .from(settlements)
    .where(and(eq(settlements.debtorId, debtorId), eq(settlements.creditorId, creditorId)));
  return rows.length;
}

/**
 * Records the notification (for dedupe/audit) and either sends it right
 * away, or — if "now" falls in the recipient's quiet hours — leaves it
 * queued with a scheduled_for the cron job will pick up later. Idempotent
 * per (betId, kind, eventId, userId): a second call for the same event is
 * a no-op, so callers don't need to guard against double-firing.
 */
export async function dispatchImmediate(params: {
  betId: string;
  userId: string;
  kind: NotificationKind;
  eventId: string;
  betStatement: string;
  placeholders?: Partial<CopyPlaceholders>;
}): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, params.userId));
  if (!user || !user.notifyEmail) return;

  const now = new Date();
  const adjusted = applyQuietHours(now, user.timezone);
  const willSendNow = adjusted.getTime() === now.getTime();

  const [inserted] = await db
    .insert(notifications)
    .values({
      betId: params.betId,
      userId: params.userId,
      kind: params.kind,
      channel: "email",
      scheduledFor: adjusted,
      dedupeKey: `${params.betId}:${params.kind}:${params.eventId}:${params.userId}`,
    })
    .onConflictDoNothing()
    .returning();

  if (!inserted) return;
  if (!willSendNow) return;

  const text = renderNotificationCopy(params.kind, user.tone, params.betId, {
    bet: params.betStatement,
    ...params.placeholders,
  });

  try {
    await sendMail({ to: user.email, subject: "Coupe", text });
    await db
      .update(notifications)
      .set({ sentAt: new Date() })
      .where(eq(notifications.id, inserted.id));
  } catch (err) {
    await db
      .update(notifications)
      .set({ error: err instanceof Error ? err.message : String(err) })
      .where(eq(notifications.id, inserted.id));
  }
}

/**
 * Fans out the "bet settled" event (§4.1) to every position-holder with
 * outcome-appropriate copy: winners and losers get different pools, VOID
 * gets a neutral notice, and nobody gets blamed or credited outside the
 * bet itself.
 */
export async function dispatchResolutionNotifications(params: {
  betId: string;
  betStatement: string;
  resolutionId: string;
  outcome: "YES" | "NO" | "VOID";
  positionUsers: { userId: string; side: "YES" | "NO"; name: string }[];
}): Promise<void> {
  const { betId, betStatement, resolutionId, outcome, positionUsers } = params;

  if (outcome === "VOID") {
    for (const p of positionUsers) {
      await dispatchImmediate({
        betId,
        userId: p.userId,
        kind: "RESOLUTION_VOID",
        eventId: resolutionId,
        betStatement,
      });
    }
    return;
  }

  const winners = positionUsers.filter((p) => p.side === outcome);
  const losers = positionUsers.filter((p) => p.side !== outcome);

  for (const winner of winners) {
    for (const loser of losers) {
      const bottles = await countBottlesBetween(loser.userId, winner.userId);
      await dispatchImmediate({
        betId,
        userId: winner.userId,
        kind: "RESOLUTION_WINNER",
        eventId: `${resolutionId}:${loser.userId}`,
        betStatement,
        placeholders: { loser: loser.name, bottles: bottleLabel(bottles) },
      });
    }
  }

  for (const loser of losers) {
    for (const winner of winners) {
      const bottles = await countBottlesBetween(loser.userId, winner.userId);
      await dispatchImmediate({
        betId,
        userId: loser.userId,
        kind: "RESOLUTION_LOSER",
        eventId: `${resolutionId}:${winner.userId}`,
        betStatement,
        placeholders: { winner: winner.name, bottles: bottleLabel(bottles) },
      });
    }
  }
}
