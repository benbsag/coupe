import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { sendMail } from "@/lib/email";
import {
  renderNotificationCopy,
  type NotificationKind,
  type CopyPlaceholders,
} from "./copy";
import { applyQuietHours } from "./quiet-hours";

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
 * Announces a settled bet to both parties. When there's a winner, everyone
 * gets the same "time to pour some champagne for {winner}" note; a VOID
 * outcome gets a neutral "no winner" note instead. Nobody is singled out as
 * the loser — the announcement reads the same for both recipients.
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

  const winnerName = positionUsers
    .filter((p) => p.side === outcome)
    .map((p) => p.name)
    .join(" & ");

  for (const p of positionUsers) {
    await dispatchImmediate({
      betId,
      userId: p.userId,
      kind: "RESOLUTION_ANNOUNCED",
      eventId: resolutionId,
      betStatement,
      placeholders: { winner: winnerName },
    });
  }
}
