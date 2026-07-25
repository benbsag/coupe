"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, bets, settlements } from "@/db/schema";
import { requireCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "./bets";

export async function markSettlementPaid(
  settlementId: string,
  note?: string
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  const [settlement] = await db
    .select()
    .from(settlements)
    .where(eq(settlements.id, settlementId));
  if (!settlement) return { ok: false, errors: ["Settlement not found."] };
  if (settlement.status !== "OWED") {
    return { ok: false, errors: ["This is already marked paid."] };
  }
  if (settlement.debtorId !== user.id && settlement.creditorId !== user.id) {
    return { ok: false, errors: ["Only the two people in this debt can mark it paid."] };
  }

  const [bet] = await db.select().from(bets).where(eq(bets.id, settlement.betId));

  await db.transaction(async (tx) => {
    await tx
      .update(settlements)
      .set({
        status: "PAID",
        paidAt: new Date(),
        paidMarkedBy: user.id,
        paidNote: note || null,
      })
      .where(eq(settlements.id, settlementId));

    await tx.insert(activityLog).values({
      betId: settlement.betId,
      actorId: user.id,
      action: "SETTLEMENT_PAID",
      meta: { settlementId, note: note || null },
    });
  });

  if (bet) revalidatePath(`/bets/${bet.slug}`);
  return { ok: true, slug: bet?.slug };
}
