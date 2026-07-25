"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  bets,
  positions,
  resolutions,
  resolutionVotes,
  settlements,
} from "@/db/schema";
import { requireCurrentUser } from "@/lib/current-user";
import { proposeResolutionSchema } from "@/lib/validation/resolution";
import { dispatchImmediate, dispatchResolutionNotifications } from "@/lib/notifications/dispatch";
import { cancelAllPendingNotifications } from "@/lib/notifications/schedule";
import { otherParticipants, betPositionUsers } from "@/lib/notifications/participants";
import type { ActionResult } from "./bets";

const RESOLVABLE_STATUSES = ["ACTIVE", "AWAITING_RESOLUTION", "DISPUTED"];

/**
 * Any participant proposes YES/NO/VOID with optional evidence (§5). Their
 * own confirmation is recorded automatically, mirroring the amendment flow
 * — everyone else must explicitly confirm or dispute.
 */
export async function proposeResolution(
  betId: string,
  rawInput: unknown
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  const parsed = proposeResolutionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  }
  const input = parsed.data;

  const [bet] = await db.select().from(bets).where(eq(bets.id, betId));
  if (!bet) return { ok: false, errors: ["Bet not found."] };
  if (!RESOLVABLE_STATUSES.includes(bet.status)) {
    return { ok: false, errors: ["This bet can't be called in its current state."] };
  }

  const ownPosition = await db
    .select()
    .from(positions)
    .where(and(eq(positions.betId, betId), eq(positions.userId, user.id)));
  if (ownPosition.length === 0) {
    return { ok: false, errors: ["Only participants can call a bet."] };
  }

  const openResolution = await db
    .select()
    .from(resolutions)
    .where(and(eq(resolutions.betId, betId), eq(resolutions.status, "PROPOSED")));
  if (openResolution.length > 0) {
    return {
      ok: false,
      errors: ["There's already a proposed outcome awaiting confirmation."],
    };
  }

  const resolutionId = await db.transaction(async (tx) => {
    const [resolution] = await tx
      .insert(resolutions)
      .values({
        betId,
        proposedOutcome: input.outcome,
        proposedBy: user.id,
        evidenceUrl: input.evidenceUrl || null,
        evidenceNote: input.evidenceNote || null,
      })
      .returning();

    await tx.insert(resolutionVotes).values({
      resolutionId: resolution.id,
      userId: user.id,
      agree: true,
    });

    await tx.insert(activityLog).values({
      betId,
      actorId: user.id,
      action: "OUTCOME_PROPOSED",
      meta: { resolutionId: resolution.id, outcome: input.outcome },
    });

    if (bet.status !== "AWAITING_RESOLUTION") {
      await tx
        .update(bets)
        .set({ status: "AWAITING_RESOLUTION" })
        .where(eq(bets.id, betId));
    }

    return resolution.id;
  });

  const others = await otherParticipants(betId, user.id);
  for (const recipient of others) {
    await dispatchImmediate({
      betId,
      userId: recipient.id,
      kind: "OUTCOME_PROPOSED",
      eventId: resolutionId,
      betStatement: bet.statement,
      placeholders: { proposer: user.name },
    });
  }

  revalidatePath(`/bets/${bet.slug}`);
  return { ok: true, slug: bet.slug };
}

export async function voteOnResolution(
  resolutionId: string,
  agree: boolean,
  comment?: string
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  const result = await db.transaction(async (tx) => {
    const [resolution] = await tx
      .select()
      .from(resolutions)
      .where(eq(resolutions.id, resolutionId));
    if (!resolution) return { ok: false, errors: ["Outcome not found."] };
    if (resolution.status !== "PROPOSED") {
      return { ok: false, errors: ["This outcome has already been decided."] };
    }

    const [bet] = await tx.select().from(bets).where(eq(bets.id, resolution.betId));
    if (!bet) return { ok: false, errors: ["Bet not found."] };

    const existingVote = await tx
      .select()
      .from(resolutionVotes)
      .where(
        and(
          eq(resolutionVotes.resolutionId, resolutionId),
          eq(resolutionVotes.userId, user.id)
        )
      );
    if (existingVote.length > 0) {
      return { ok: false, errors: ["You've already voted on this outcome."] };
    }

    await tx.insert(resolutionVotes).values({
      resolutionId,
      userId: user.id,
      agree,
      comment: comment || null,
    });
    await tx.insert(activityLog).values({
      betId: bet.id,
      actorId: user.id,
      action: agree ? "OUTCOME_CONFIRM_VOTE" : "OUTCOME_DISPUTE_VOTE",
      meta: { resolutionId },
    });

    if (!agree) {
      // Any single dispute closes this attempt (§5) — no arbitration, the
      // app just holds the disagreement legibly. A new proposal is the
      // only way forward from here.
      await tx
        .update(resolutions)
        .set({ status: "DISPUTED" })
        .where(eq(resolutions.id, resolutionId));
      await tx.update(bets).set({ status: "DISPUTED" }).where(eq(bets.id, bet.id));
      await tx.insert(activityLog).values({
        betId: bet.id,
        actorId: user.id,
        action: "OUTCOME_DISPUTED",
        meta: { resolutionId },
      });
      return {
        ok: true,
        slug: bet.slug,
        betId: bet.id,
        betStatement: bet.statement,
        outcome: "disputed" as const,
      };
    }

    const allPositions = await tx
      .select()
      .from(positions)
      .where(eq(positions.betId, bet.id));
    const allVotes = await tx
      .select()
      .from(resolutionVotes)
      .where(eq(resolutionVotes.resolutionId, resolutionId));
    const confirmedUserIds = new Set(
      allVotes.filter((v) => v.agree).map((v) => v.userId)
    );
    const unanimous = allPositions.every((p) => confirmedUserIds.has(p.userId));

    if (unanimous) {
      const now = new Date();
      await tx
        .update(resolutions)
        .set({ status: "CONFIRMED", confirmedAt: now })
        .where(eq(resolutions.id, resolutionId));
      await tx
        .update(bets)
        .set({ status: "RESOLVED", resolvedAt: now })
        .where(eq(bets.id, bet.id));

      if (resolution.proposedOutcome !== "VOID") {
        const winningSide = resolution.proposedOutcome;
        const winners = allPositions.filter((p) => p.side === winningSide);
        const losers = allPositions.filter((p) => p.side !== winningSide);
        for (const loser of losers) {
          for (const winner of winners) {
            await tx
              .insert(settlements)
              .values({
                betId: bet.id,
                debtorId: loser.userId,
                creditorId: winner.userId,
                status: "OWED",
              })
              .onConflictDoNothing();
          }
        }
      }

      await tx.insert(activityLog).values({
        betId: bet.id,
        actorId: user.id,
        action: "RESOLVED",
        meta: { resolutionId, outcome: resolution.proposedOutcome },
      });

      return {
        ok: true,
        slug: bet.slug,
        betId: bet.id,
        betStatement: bet.statement,
        outcome: "confirmed" as const,
        resolutionId,
        proposedOutcome: resolution.proposedOutcome,
      };
    }

    return { ok: true, slug: bet.slug, outcome: "pending" as const };
  });

  if (!result.ok) return result;

  if (result.outcome === "disputed") {
    const others = await otherParticipants(result.betId, user.id);
    for (const recipient of others) {
      await dispatchImmediate({
        betId: result.betId,
        userId: recipient.id,
        kind: "OUTCOME_DISPUTED",
        eventId: resolutionId,
        betStatement: result.betStatement,
      });
    }
  }

  if (result.outcome === "confirmed") {
    const positionUsers = await betPositionUsers(result.betId);
    await dispatchResolutionNotifications({
      betId: result.betId,
      betStatement: result.betStatement,
      resolutionId: result.resolutionId,
      outcome: result.proposedOutcome,
      positionUsers,
    });
    // Bet is settled — no point reminding anyone about a deadline that no
    // longer matters.
    await cancelAllPendingNotifications(result.betId);
  }

  if (result.slug) revalidatePath(`/bets/${result.slug}`);
  return result;
}
