import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bets } from "@/db/schema";

export async function listBets() {
  return db.query.bets.findMany({
    orderBy: [desc(bets.createdAt)],
    with: {
      positions: { with: { user: true } },
      creator: true,
    },
  });
}

export async function getBetBySlug(slug: string) {
  const bet = await db.query.bets.findFirst({
    where: eq(bets.slug, slug),
    with: {
      positions: { with: { user: true } },
      creator: true,
      versions: { orderBy: (v, { asc }) => [asc(v.version)] },
      activity: {
        orderBy: (a, { desc }) => [desc(a.createdAt)],
        with: { actor: true },
      },
      amendments: {
        orderBy: (a, { desc }) => [desc(a.createdAt)],
        with: { proposer: true, votes: { with: { user: true } } },
      },
    },
  });
  return bet ?? null;
}

export type BetListItem = Awaited<ReturnType<typeof listBets>>[number];
export type BetDetail = NonNullable<Awaited<ReturnType<typeof getBetBySlug>>>;
