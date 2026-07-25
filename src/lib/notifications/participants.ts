import { eq } from "drizzle-orm";
import { db } from "@/db";
import { positions, users } from "@/db/schema";

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
