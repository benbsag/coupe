import { eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { positions, users } from "@/db/schema";

/**
 * Everyone other than the given user. Used at proposal time to reach the
 * counterparty, who hasn't taken a position yet — so we can't rely on the
 * positions table the way the other helpers here do.
 */
export async function counterpartyUsers(excludeUserId: string) {
  return db.select().from(users).where(ne(users.id, excludeUserId));
}

export async function betParticipants(betId: string) {
  const rows = await db
    .select({ user: users })
    .from(positions)
    .innerJoin(users, eq(positions.userId, users.id))
    .where(eq(positions.betId, betId));
  return rows.map((r) => r.user);
}

export async function otherParticipants(betId: string, excludeUserId: string) {
  const all = await betParticipants(betId);
  return all.filter((u) => u.id !== excludeUserId);
}

export async function betPositionUsers(betId: string) {
  const rows = await db
    .select({ userId: positions.userId, side: positions.side, name: users.name })
    .from(positions)
    .innerJoin(users, eq(positions.userId, users.id))
    .where(eq(positions.betId, betId));
  return rows;
}
