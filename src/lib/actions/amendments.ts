"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  amendments,
  amendmentVotes,
  bets,
  betVersions,
  positions,
} from "@/db/schema";
import { requireCurrentUser } from "@/lib/current-user";
import { proposeAmendmentSchema } from "@/lib/validation/amendment";
import { enforceHardRules } from "@/lib/validation/bet";
import { zurichEndOfDayToUtc } from "@/lib/dates";
import { contentHashFor } from "@/lib/hash";
import { dispatchImmediate } from "@/lib/notifications/dispatch";
import {
  cancelPendingThresholds,
  scheduleThresholdNotifications,
} from "@/lib/notifications/schedule";
import { otherParticipants } from "@/lib/notifications/participants";
import type { ActionResult } from "./bets";

const AMENDABLE_STATUSES = ["ACTIVE", "AWAITING_RESOLUTION", "DISPUTED"];

function parseDateField(raw: string | undefined | null) {
  const trimmed = raw?.trim() || null;
  const parsed = trimmed ? zurichEndOfDayToUtc(trimmed) : null;
  return { raw: trimmed, parsed };
}

function jsonbDate(value: unknown): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value as string);
}

interface AmendmentPayload {
  kind: "FIXED_DATE" | "EVENT_TRIGGERED" | "CONTINGENT";
  statement: string;
  terms: string;
  resolutionCriteria: string;
  resolutionDate: string | null;
  longStopDate: string | null;
  stakeNote: string | null;
}

/**
 * Proposer's own approval is implicit — this immediately records their
 * APPROVE vote so the unanimity check only waits on everyone else, matching
 * §3's "all other participants see a diff ... each approves or rejects".
 */
export async function proposeAmendment(
  betId: string,
  rawInput: unknown
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  const parsed = proposeAmendmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  }
  const input = parsed.data;

  const resolutionDate = parseDateField(input.resolutionDateInput);
  const longStopDate = parseDateField(input.longStopDateInput);

  const errors = enforceHardRules(
    { kind: input.kind },
    {
      resolutionDateRaw: resolutionDate.raw,
      resolutionDateParsed: resolutionDate.parsed,
      expectedResolutionDateRaw: null,
      expectedResolutionDateParsed: null,
      longStopDateRaw: longStopDate.raw,
      longStopDateParsed: longStopDate.parsed,
    }
  );
  if (errors.length > 0) return { ok: false, errors };

  const [bet] = await db.select().from(bets).where(eq(bets.id, betId));
  if (!bet) return { ok: false, errors: ["Bet not found."] };
  if (!AMENDABLE_STATUSES.includes(bet.status)) {
    return { ok: false, errors: ["This bet can't be amended in its current state."] };
  }

  const ownPosition = await db
    .select()
    .from(positions)
    .where(and(eq(positions.betId, betId), eq(positions.userId, user.id)));
  if (ownPosition.length === 0) {
    return { ok: false, errors: ["Only participants can propose amendments."] };
  }

  const openAmendment = await db
    .select()
    .from(amendments)
    .where(and(eq(amendments.betId, betId), eq(amendments.status, "OPEN")));
  if (openAmendment.length > 0) {
    return {
      ok: false,
      errors: ["There's already an open amendment on this bet — resolve that one first."],
    };
  }

  const proposedPayload: AmendmentPayload = {
    kind: input.kind,
    statement: input.statement,
    terms: input.terms,
    resolutionCriteria: input.resolutionCriteria,
    resolutionDate: resolutionDate.parsed?.toISOString() ?? null,
    longStopDate: longStopDate.parsed?.toISOString() ?? null,
    stakeNote: input.stakeNote || null,
  };

  const amendmentId = await db.transaction(async (tx) => {
    const [amendment] = await tx
      .insert(amendments)
      .values({
        betId,
        proposedBy: user.id,
        proposedPayload,
        reason: input.reason,
      })
      .returning();

    await tx.insert(amendmentVotes).values({
      amendmentId: amendment.id,
      userId: user.id,
      decision: "APPROVE",
    });

    await tx.insert(activityLog).values({
      betId,
      actorId: user.id,
      action: "AMENDMENT_PROPOSED",
      meta: { amendmentId: amendment.id, reason: input.reason },
    });

    return amendment.id;
  });

  const others = await otherParticipants(betId, user.id);
  for (const recipient of others) {
    await dispatchImmediate({
      betId,
      userId: recipient.id,
      kind: "AMENDMENT_PROPOSED",
      eventId: amendmentId,
      betStatement: bet.statement,
      placeholders: { proposer: user.name },
    });
  }

  revalidatePath(`/bets/${bet.slug}`);
  return { ok: true, slug: bet.slug };
}

export async function voteOnAmendment(
  amendmentId: string,
  decision: "APPROVE" | "REJECT",
  comment?: string
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  const result = await db.transaction(async (tx) => {
    const [amendment] = await tx
      .select()
      .from(amendments)
      .where(eq(amendments.id, amendmentId));
    if (!amendment) return { ok: false, errors: ["Amendment not found."] };
    if (amendment.status !== "OPEN") {
      return { ok: false, errors: ["This amendment has already been decided."] };
    }

    const [bet] = await tx.select().from(bets).where(eq(bets.id, amendment.betId));
    if (!bet) return { ok: false, errors: ["Bet not found."] };

    const existingVote = await tx
      .select()
      .from(amendmentVotes)
      .where(
        and(
          eq(amendmentVotes.amendmentId, amendmentId),
          eq(amendmentVotes.userId, user.id)
        )
      );
    if (existingVote.length > 0) {
      return { ok: false, errors: ["You've already voted on this amendment."] };
    }

    await tx.insert(amendmentVotes).values({
      amendmentId,
      userId: user.id,
      decision,
      comment: comment || null,
    });
    await tx.insert(activityLog).values({
      betId: bet.id,
      actorId: user.id,
      action: decision === "APPROVE" ? "AMENDMENT_VOTE_APPROVE" : "AMENDMENT_VOTE_REJECT",
      meta: { amendmentId },
    });

    if (decision === "REJECT") {
      await tx
        .update(amendments)
        .set({ status: "REJECTED", closedAt: new Date() })
        .where(eq(amendments.id, amendmentId));
      await tx.insert(activityLog).values({
        betId: bet.id,
        actorId: user.id,
        action: "AMENDMENT_REJECTED",
        meta: { amendmentId },
      });
      return {
        ok: true,
        slug: bet.slug,
        betId: bet.id,
        betStatement: bet.statement,
        outcome: "rejected" as const,
      };
    }

    // Unanimous or nothing (§3): every current position-holder needs an
    // APPROVE vote, not just a majority, and no timeout ever auto-approves.
    const allPositions = await tx
      .select()
      .from(positions)
      .where(eq(positions.betId, bet.id));
    const allVotes = await tx
      .select()
      .from(amendmentVotes)
      .where(eq(amendmentVotes.amendmentId, amendmentId));
    const approvedUserIds = new Set(
      allVotes.filter((v) => v.decision === "APPROVE").map((v) => v.userId)
    );
    const unanimous = allPositions.every((p) => approvedUserIds.has(p.userId));

    if (unanimous) {
      const payload = amendment.proposedPayload as AmendmentPayload;
      const [latestVersion] = await tx
        .select()
        .from(betVersions)
        .where(eq(betVersions.betId, bet.id))
        .orderBy(desc(betVersions.version))
        .limit(1);

      const newVersionPayload = {
        kind: payload.kind,
        statement: payload.statement,
        terms: payload.terms,
        resolutionCriteria: payload.resolutionCriteria,
        resolutionDate: payload.resolutionDate,
        longStopDate: payload.longStopDate,
        stakeNote: payload.stakeNote,
        positions: allPositions
          .map((p) => ({ userId: p.userId, side: p.side }))
          .sort((a, b) => a.userId.localeCompare(b.userId)),
      };
      const contentHash = contentHashFor(newVersionPayload);
      const nextVersion = (latestVersion?.version ?? bet.currentVersion) + 1;

      // Escape hatch the immutability trigger checks for: without this,
      // updating frozen fields on a locked bet would raise straight out of
      // Postgres (see drizzle/0001_immutability_triggers.sql).
      await tx.execute(sql`SET LOCAL app.allow_amendment = 'on'`);
      await tx
        .update(bets)
        .set({
          statement: payload.statement,
          terms: payload.terms,
          kind: payload.kind,
          resolutionCriteria: payload.resolutionCriteria,
          resolutionDate: jsonbDate(payload.resolutionDate),
          longStopDate: jsonbDate(payload.longStopDate),
          stakeNote: payload.stakeNote,
          currentVersion: nextVersion,
        })
        .where(eq(bets.id, bet.id));

      await tx.insert(betVersions).values({
        betId: bet.id,
        version: nextVersion,
        payload: newVersionPayload,
        contentHash,
        prevHash: latestVersion?.contentHash ?? null,
        createdBy: user.id,
        reason: amendment.reason,
      });

      await tx
        .update(amendments)
        .set({ status: "APPROVED", closedAt: new Date() })
        .where(eq(amendments.id, amendmentId));
      await tx.insert(activityLog).values({
        betId: bet.id,
        actorId: user.id,
        action: "AMENDMENT_APPROVED",
        meta: { amendmentId, contentHash },
      });

      const dateChanged =
        bet.resolutionDate?.getTime() !== jsonbDate(payload.resolutionDate)?.getTime() ||
        bet.longStopDate?.getTime() !== jsonbDate(payload.longStopDate)?.getTime();

      return {
        ok: true,
        slug: bet.slug,
        betId: bet.id,
        betStatement: payload.statement,
        outcome: "approved" as const,
        dateChanged,
      };
    }

    return { ok: true, slug: bet.slug, outcome: "pending" as const };
  });

  if (!result.ok) return result;

  // No email on the amendment's outcome — only the proposal itself notifies
  // the other party (see proposeAmendment). The vote result is visible in-app.

  if (result.outcome === "approved" && result.dateChanged) {
    await cancelPendingThresholds(result.betId!);
    await scheduleThresholdNotifications(result.betId!);
  }

  if (result.slug) revalidatePath(`/bets/${result.slug}`);
  return result;
}

export async function withdrawAmendment(amendmentId: string): Promise<ActionResult> {
  const user = await requireCurrentUser();

  const [amendment] = await db
    .select()
    .from(amendments)
    .where(eq(amendments.id, amendmentId));
  if (!amendment) return { ok: false, errors: ["Amendment not found."] };
  if (amendment.proposedBy !== user.id) {
    return { ok: false, errors: ["Only the proposer can withdraw this amendment."] };
  }
  if (amendment.status !== "OPEN") {
    return { ok: false, errors: ["This amendment is already decided."] };
  }

  const [bet] = await db.select().from(bets).where(eq(bets.id, amendment.betId));

  await db.transaction(async (tx) => {
    await tx
      .update(amendments)
      .set({ status: "WITHDRAWN", closedAt: new Date() })
      .where(eq(amendments.id, amendmentId));
    await tx.insert(activityLog).values({
      betId: amendment.betId,
      actorId: user.id,
      action: "AMENDMENT_WITHDRAWN",
      meta: { amendmentId },
    });
  });

  if (bet) revalidatePath(`/bets/${bet.slug}`);
  return { ok: true, slug: bet?.slug };
}
