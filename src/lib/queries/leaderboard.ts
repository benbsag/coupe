import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { bets, positions, resolutions, settlements, users } from "@/db/schema";

const OPEN_STATUSES = ["ACTIVE", "AWAITING_RESOLUTION", "DISPUTED"] as const;

export interface LeaderboardEntry {
  userId: string;
  name: string;
  wins: number;
  losses: number;
  voids: number;
  bottlesWon: number;
  bottlesOwed: number;
  netBalance: number;
  outstandingDebtsCount: number;
  oldestOutstandingDebtDays: number | null;
  openPositionsCount: number;
  bottlesAtRisk: number;
  streakType: "W" | "L" | null;
  streakCount: number;
}

async function computeRecordAndStreak(userId: string) {
  // Every RESOLVED bet has exactly one CONFIRMED resolution — a bet only
  // reaches RESOLVED via that unanimous confirm (§5) — so this join never
  // produces more than one row per bet.
  const rows = await db
    .select({ side: positions.side, outcome: resolutions.proposedOutcome })
    .from(positions)
    .innerJoin(bets, eq(positions.betId, bets.id))
    .innerJoin(
      resolutions,
      and(eq(resolutions.betId, bets.id), eq(resolutions.status, "CONFIRMED"))
    )
    .where(and(eq(positions.userId, userId), eq(bets.status, "RESOLVED")))
    .orderBy(desc(bets.resolvedAt));

  let wins = 0;
  let losses = 0;
  let streakType: "W" | "L" | null = null;
  let streakCount = 0;

  rows.forEach((r, i) => {
    const result: "W" | "L" = r.side === r.outcome ? "W" : "L";
    if (result === "W") wins++;
    else losses++;

    // streakCount === i holds only while every row so far has matched the
    // streak — once one breaks it, streakCount freezes and this condition
    // can never be true again, so later rows stop being counted.
    if (i === 0) {
      streakType = result;
      streakCount = 1;
    } else if (streakType !== null && streakCount === i && result === streakType) {
      streakCount++;
    }
  });

  return { wins, losses, streakType, streakCount };
}

async function countVoids(userId: string): Promise<number> {
  const rows = await db
    .select({ betId: bets.id })
    .from(positions)
    .innerJoin(bets, eq(positions.betId, bets.id))
    .where(
      and(
        eq(positions.userId, userId),
        or(eq(bets.status, "VOID"), eq(bets.status, "LAPSED"))
      )
    );
  return rows.length;
}

async function bottleTotals(userId: string) {
  const won = await db
    .select()
    .from(settlements)
    .where(eq(settlements.creditorId, userId));
  const owed = await db
    .select()
    .from(settlements)
    .where(eq(settlements.debtorId, userId));
  return { bottlesWon: won.length, bottlesOwed: owed.length };
}

async function outstandingDebts(userId: string) {
  const rows = await db
    .select()
    .from(settlements)
    .where(and(eq(settlements.debtorId, userId), eq(settlements.status, "OWED")))
    .orderBy(settlements.createdAt);
  const oldest = rows[0];
  const oldestDays = oldest
    ? Math.floor((Date.now() - oldest.createdAt.getTime()) / 86_400_000)
    : null;
  return { count: rows.length, oldestDays };
}

async function openExposure(userId: string) {
  const rows = await db
    .select({ betId: positions.betId, side: positions.side })
    .from(positions)
    .innerJoin(bets, eq(positions.betId, bets.id))
    .where(and(eq(positions.userId, userId), inArray(bets.status, OPEN_STATUSES)));

  let bottlesAtRisk = 0;
  for (const r of rows) {
    const opposing = await db
      .select()
      .from(positions)
      .where(and(eq(positions.betId, r.betId), ne(positions.side, r.side)));
    bottlesAtRisk += opposing.length;
  }
  return { openPositionsCount: rows.length, bottlesAtRisk };
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const allUsers = await db.select().from(users);

  const entries: LeaderboardEntry[] = [];
  for (const u of allUsers) {
    const [record, voids, bottles, debts, exposure] = await Promise.all([
      computeRecordAndStreak(u.id),
      countVoids(u.id),
      bottleTotals(u.id),
      outstandingDebts(u.id),
      openExposure(u.id),
    ]);

    entries.push({
      userId: u.id,
      name: u.name,
      wins: record.wins,
      losses: record.losses,
      voids,
      bottlesWon: bottles.bottlesWon,
      bottlesOwed: bottles.bottlesOwed,
      netBalance: bottles.bottlesWon - bottles.bottlesOwed,
      outstandingDebtsCount: debts.count,
      oldestOutstandingDebtDays: debts.oldestDays,
      openPositionsCount: exposure.openPositionsCount,
      bottlesAtRisk: exposure.bottlesAtRisk,
      streakType: record.streakType,
      streakCount: record.streakCount,
    });
  }

  // Sort by net balance; ties broken by fewest unpaid debts.
  entries.sort((a, b) => {
    if (b.netBalance !== a.netBalance) return b.netBalance - a.netBalance;
    return a.outstandingDebtsCount - b.outstandingDebtsCount;
  });

  return entries;
}

/** N×N: grid[a][b] = net bottles b owes a (positive) or a owes b (negative). */
export async function getHeadToHead(userIds: string[]): Promise<Record<string, Record<string, number>>> {
  const all = await db.select().from(settlements);
  const grid: Record<string, Record<string, number>> = {};
  for (const a of userIds) {
    grid[a] = {};
    for (const b of userIds) {
      if (a === b) {
        grid[a][b] = 0;
        continue;
      }
      const bOwesA = all.filter((s) => s.debtorId === b && s.creditorId === a).length;
      const aOwesB = all.filter((s) => s.debtorId === a && s.creditorId === b).length;
      grid[a][b] = bOwesA - aOwesB;
    }
  }
  return grid;
}

export async function getRecentlyPoured(limit = 5) {
  return db.query.settlements.findMany({
    where: eq(settlements.status, "PAID"),
    orderBy: (s, { desc }) => [desc(s.paidAt)],
    limit,
    with: { debtor: true, creditor: true, bet: true },
  });
}

export async function getOpenDebts() {
  return db.query.settlements.findMany({
    where: eq(settlements.status, "OWED"),
    orderBy: (s, { asc }) => [asc(s.createdAt)],
    with: { debtor: true, creditor: true, bet: true },
  });
}
