import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { bets, notifications, users } from "@/db/schema";
import { sendMail } from "@/lib/email";
import { renderNotificationCopy, type NotificationKind } from "./copy";
import { queueDueNudges } from "./nudges";

function daysFromThresholdLabel(label: string | null): string | undefined {
  if (!label) return undefined;
  if (label === "immediate") return "0";
  const match = label.match(/^(\d+)d$/);
  return match ? match[1] : undefined;
}

interface DueNotification {
  id: string;
  betId: string;
  userId: string;
  kind: string;
  thresholdLabel: string | null;
  payload: unknown;
  betStatement: string;
}

function renderLine(n: DueNotification, tone: "dry" | "rowdy"): string {
  const payload = (n.payload as { days?: number } | null) ?? null;
  const days = daysFromThresholdLabel(n.thresholdLabel) ?? payload?.days?.toString();
  return renderNotificationCopy(n.kind as NotificationKind, tone, n.betId, {
    bet: n.betStatement,
    days,
  });
}

export interface CronSummary {
  processed: number;
  sent: number;
  errors: number;
}

/**
 * §4.2: runs every 15 minutes in production (Vercel Cron). Picks up due,
 * unsent notifications — both pre-scheduled threshold/deadline rows and
 * freshly queued nudges — groups them per recipient, and sends one digest
 * email when a user has 3+ due in this run, individual emails otherwise.
 */
export async function runNotificationCron(): Promise<CronSummary> {
  await queueDueNudges();

  const now = new Date();
  const due = await db
    .select({
      id: notifications.id,
      betId: notifications.betId,
      userId: notifications.userId,
      kind: notifications.kind,
      thresholdLabel: notifications.thresholdLabel,
      payload: notifications.payload,
      betStatement: bets.statement,
    })
    .from(notifications)
    .innerJoin(bets, eq(notifications.betId, bets.id))
    .where(and(isNull(notifications.sentAt), lte(notifications.scheduledFor, now)));

  const summary: CronSummary = { processed: due.length, sent: 0, errors: 0 };
  if (due.length === 0) return summary;

  const byUser = new Map<string, DueNotification[]>();
  for (const n of due) {
    const list = byUser.get(n.userId) ?? [];
    list.push(n);
    byUser.set(n.userId, list);
  }

  for (const [userId, items] of byUser) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) continue;

    const ids = items.map((i) => i.id);
    try {
      if (items.length >= 3) {
        const lines = items.map((n) => `- ${renderLine(n, user.tone)}`);
        await sendMail({
          to: user.email,
          subject: `Coupe — ${items.length} updates`,
          text: lines.join("\n"),
        });
      } else {
        for (const n of items) {
          await sendMail({ to: user.email, subject: "Coupe", text: renderLine(n, user.tone) });
        }
      }
      for (const id of ids) {
        await db.update(notifications).set({ sentAt: new Date() }).where(eq(notifications.id, id));
      }
      summary.sent += items.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      for (const id of ids) {
        await db.update(notifications).set({ error: message }).where(eq(notifications.id, id));
      }
      summary.errors += items.length;
    }
  }

  return summary;
}
