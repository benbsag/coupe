"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bets, comments } from "@/db/schema";
import { requireCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "./bets";

export async function addComment(betId: string, body: string): Promise<ActionResult> {
  const user = await requireCurrentUser();

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, errors: ["Comment can't be empty."] };
  if (trimmed.length > 2000) {
    return { ok: false, errors: ["Keep it under 2000 characters."] };
  }

  const [bet] = await db.select().from(bets).where(eq(bets.id, betId));
  if (!bet) return { ok: false, errors: ["Bet not found."] };

  await db.insert(comments).values({ betId, userId: user.id, body: trimmed });

  revalidatePath(`/bets/${bet.slug}`);
  return { ok: true, slug: bet.slug };
}
