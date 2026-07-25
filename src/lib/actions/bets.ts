"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, bets, betVersions, positions } from "@/db/schema";
import { requireCurrentUser } from "@/lib/current-user";
import {
  createBetSchema,
  enforceHardRules,
} from "@/lib/validation/bet";
import { zurichEndOfDayToUtc } from "@/lib/dates";
import { slugify } from "@/lib/slug";
import { contentHashFor } from "@/lib/hash";

export interface ActionResult {
  ok: boolean;
  errors?: string[];
  slug?: string;
}

function parseDateField(raw: string | undefined | null) {
  const trimmed = raw?.trim() || null;
  const parsed = trimmed ? zurichEndOfDayToUtc(trimmed) : null;
  return { raw: trimmed, parsed };
}

/**
 * Creates a bet and immediately proposes it (DRAFT is a transient in-memory
 * state in this UI, not a separate saved step — the wizard's last screen is
 * "send"). The creator's own side is recorded as their position in the same
 * transaction, matching §13's seed data where the proposer already holds a
 * side at creation time.
 */
export async function createAndSendBet(rawInput: unknown): Promise<ActionResult> {
  const user = await requireCurrentUser();

  const parsed = createBetSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  }
  const input = parsed.data;

  const resolutionDate = parseDateField(input.resolutionDateInput);
  const expectedResolutionDate = parseDateField(input.expectedResolutionDateInput);
  const longStopDate = parseDateField(input.longStopDateInput);

  const errors = enforceHardRules(input, {
    resolutionDateRaw: resolutionDate.raw,
    resolutionDateParsed: resolutionDate.parsed,
    expectedResolutionDateRaw: expectedResolutionDate.raw,
    expectedResolutionDateParsed: expectedResolutionDate.parsed,
    longStopDateRaw: longStopDate.raw,
    longStopDateParsed: longStopDate.parsed,
  });
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const slug = slugify(input.statement);

  await db.transaction(async (tx) => {
    const [bet] = await tx
      .insert(bets)
      .values({
        slug,
        kind: input.kind,
        status: "PROPOSED",
        statement: input.statement,
        terms: input.terms,
        resolutionCriteria: input.resolutionCriteria,
        resolutionDate: resolutionDate.parsed,
        expectedResolutionDate: expectedResolutionDate.parsed,
        longStopDate: longStopDate.parsed,
        stakeNote: input.stakeNote || null,
        createdBy: user.id,
      })
      .returning();

    await tx.insert(positions).values({
      betId: bet.id,
      userId: user.id,
      side: input.side,
      acceptedAt: new Date(),
    });

    await tx.insert(activityLog).values([
      { betId: bet.id, actorId: user.id, action: "CREATED", meta: { kind: input.kind } },
      { betId: bet.id, actorId: user.id, action: "PROPOSED", meta: { side: input.side } },
    ]);
  });

  revalidatePath("/");
  redirect(`/bets/${slug}`);
}

export async function withdrawBet(betId: string): Promise<ActionResult> {
  const user = await requireCurrentUser();

  const [bet] = await db.select().from(bets).where(eq(bets.id, betId));
  if (!bet) return { ok: false, errors: ["Bet not found."] };
  if (bet.createdBy !== user.id) {
    return { ok: false, errors: ["Only the proposer can withdraw a bet."] };
  }
  if (bet.status !== "DRAFT" && bet.status !== "PROPOSED") {
    return {
      ok: false,
      errors: ["This bet has already locked; it can no longer be withdrawn."],
    };
  }

  await db.transaction(async (tx) => {
    await tx.update(bets).set({ status: "VOID" }).where(eq(bets.id, betId));
    await tx.insert(activityLog).values({
      betId,
      actorId: user.id,
      action: "WITHDRAWN",
    });
  });

  revalidatePath("/");
  revalidatePath(`/bets/${bet.slug}`);
  return { ok: true, slug: bet.slug };
}

/**
 * A counterparty taking a side. Insert is the acceptance — there is no
 * separate "invited but undecided" state and no cooling-off period once a
 * side is chosen (§8 screen 4). If this is the first YES and the first NO,
 * the bet locks: terms freeze, locked_at is set, and version 1 is written
 * with its content hash.
 */
export async function acceptPosition(
  betId: string,
  side: "YES" | "NO"
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  const result = await db.transaction(async (tx) => {
    const [bet] = await tx.select().from(bets).where(eq(bets.id, betId));
    if (!bet) return { ok: false, errors: ["Bet not found."] };
    if (bet.status !== "DRAFT" && bet.status !== "PROPOSED") {
      return { ok: false, errors: ["This bet is no longer open to new positions."] };
    }

    const existing = await tx
      .select()
      .from(positions)
      .where(and(eq(positions.betId, betId), eq(positions.userId, user.id)));
    if (existing.length > 0) {
      return { ok: false, errors: ["You already have a position on this bet."] };
    }

    await tx.insert(positions).values({
      betId,
      userId: user.id,
      side,
      acceptedAt: new Date(),
    });
    await tx.insert(activityLog).values({
      betId,
      actorId: user.id,
      action: "ACCEPTED",
      meta: { side },
    });

    const allPositions = await tx
      .select()
      .from(positions)
      .where(eq(positions.betId, betId));
    const hasYes = allPositions.some((p) => p.side === "YES");
    const hasNo = allPositions.some((p) => p.side === "NO");

    if (bet.status === "PROPOSED" && hasYes && hasNo) {
      const lockedAt = new Date();
      const payload = {
        statement: bet.statement,
        terms: bet.terms,
        kind: bet.kind,
        resolutionCriteria: bet.resolutionCriteria,
        resolutionDate: bet.resolutionDate,
        longStopDate: bet.longStopDate,
        stakeNote: bet.stakeNote,
        positions: allPositions
          .map((p) => ({ userId: p.userId, side: p.side }))
          .sort((a, b) => a.userId.localeCompare(b.userId)),
      };
      const contentHash = contentHashFor(payload);

      await tx
        .update(bets)
        .set({ status: "ACTIVE", lockedAt, currentVersion: 1 })
        .where(eq(bets.id, betId));
      await tx.insert(betVersions).values({
        betId,
        version: 1,
        payload,
        contentHash,
        prevHash: null,
        createdBy: user.id,
        reason: "Initial lock",
      });
      await tx.insert(activityLog).values({
        betId,
        actorId: user.id,
        action: "LOCKED",
        meta: { contentHash },
      });
    }

    return { ok: true, slug: bet.slug };
  });

  revalidatePath("/");
  if (result.slug) revalidatePath(`/bets/${result.slug}`);
  return result;
}
