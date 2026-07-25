import type { Adapter, AdapterUser } from "next-auth/adapters";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, verificationTokens } from "@/db/schema";

function toAdapterUser(row: typeof users.$inferSelect): AdapterUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    // Coupe has no self-service signup; reaching a valid session at all
    // means the invite-only allowlist + magic link already verified them.
    emailVerified: row.createdAt,
    image: null,
  };
}

/**
 * Minimal Auth.js adapter over Coupe's own `users` table, instead of the
 * generic four-table shape @auth/drizzle-adapter expects. Invite-only means
 * `createUser` should never actually fire — accounts are seeded — so it
 * throws rather than silently provisioning strangers.
 */
export function CoupeAdapter(): Adapter {
  return {
    async createVerificationToken({ identifier, token, expires }) {
      await db.insert(verificationTokens).values({ identifier, token, expires });
      return { identifier, token, expires };
    },

    async useVerificationToken({ identifier, token }) {
      const [row] = await db
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, identifier),
            eq(verificationTokens.token, token)
          )
        )
        .returning();
      return row ?? null;
    },

    async getUser(id) {
      const [row] = await db.select().from(users).where(eq(users.id, id));
      return row ? toAdapterUser(row) : null;
    },

    async getUserByEmail(email) {
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()));
      return row ? toAdapterUser(row) : null;
    },

    async createUser() {
      throw new Error(
        "Coupe is invite-only: accounts are seeded, not created at sign-in."
      );
    },

    // Auth.js's email-provider login flow calls updateUser on every
    // successful sign-in (to stamp emailVerified), even for accounts that
    // already exist. Coupe doesn't model verification separately from
    // "received a valid magic link", so this is a no-op passthrough.
    async updateUser(user) {
      const [row] = await db.select().from(users).where(eq(users.id, user.id));
      if (!row) throw new Error("User not found.");
      return toAdapterUser(row);
    },
  };
}
