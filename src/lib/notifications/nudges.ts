import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bets, notifications, users } from "@/db/schema";
import { gaugeTarget } from "@/lib/bet-display";
import { betPositionUsers } from "./participants";
import { applyQuietHours } from "./quiet-hours";

// §4.1: +3d and +10d after the deadline while still AWAITING_RESOLUTION,
// then weekly, capped at 6 nudges total.
const NUDGE_OFFSET_DAYS = [3, 10, 17, 24, 31, 38];

/**
 * Queues the next due nudge (if any) for every bet still awaiting a call.
 * Paced by real time since the *last nudge actually sent* — not by how
 * overdue the bet's deadline is — so a bet that was already months overdue
 * when nudging first ran doesn't burst through all 6 levels in the first
 * few cron ticks. The first nudge is the only one gated on the deadline
 * itself (§4.1: +3d after deadline); every nudge after that needs the
 * appropriate gap since the previous one actually went out.
 */
export async function queueDueNudges(): Promise<void> {
  const awaitingBets = await db
    .select()
    .from(bets)
    .where(eq(bets.status, "AWAITING_RESOLUTION"));
  const now = new Date();

  for (const bet of awaitingBets) {
    const target = gaugeTarget(bet);
    if (!target) continue;

    const elapsedDays = (now.getTime() - target.getTime()) / 86_400_000;
    if (elapsedDays < NUDGE_OFFSET_DAYS[0]) continue;

    const participants = await betPositionUsers(bet.id);
    for (const p of participants) {
      const existing = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.betId, bet.id),
            eq(notifications.userId, p.userId),
            eq(notifications.kind, "NUDGE")
          )
        );

      let nextIndex: number;
      if (existing.length === 0) {
        nextIndex = 0;
      } else {
        const latest = existing.reduce((a, b) =>
          Number(a.thresholdLabel) > Number(b.thresholdLabel) ? a : b
        );
        if (!latest.sentAt) continue; // previous nudge still pending — don't pile on
        const lastIndex = Number(latest.thresholdLabel);
        nextIndex = lastIndex + 1;
        if (nextIndex >= NUDGE_OFFSET_DAYS.length) continue;
        const gapNeededDays = NUDGE_OFFSET_DAYS[nextIndex] - NUDGE_OFFSET_DAYS[lastIndex];
        const daysSinceLastSend = (now.getTime() - latest.sentAt.getTime()) / 86_400_000;
        if (daysSinceLastSend < gapNeededDays) continue;
      }

      const [recipient] = await db.select().from(users).where(eq(users.id, p.userId));
      if (!recipient?.notifyEmail) continue;

      await db
        .insert(notifications)
        .values({
          betId: bet.id,
          userId: p.userId,
          kind: "NUDGE",
          thresholdLabel: String(nextIndex),
          channel: "email",
          scheduledFor: applyQuietHours(now, recipient.timezone),
          dedupeKey: `${bet.id}:NUDGE:${nextIndex}:${p.userId}`,
          payload: { days: Math.floor(elapsedDays) },
        })
        .onConflictDoNothing();
    }
  }
}
