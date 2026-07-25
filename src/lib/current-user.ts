import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function getCurrentUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  return row ?? null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}

export async function listAllUsers() {
  return db.select().from(users).orderBy(users.name);
}
