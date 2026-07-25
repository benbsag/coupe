import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  activityLog,
  bets,
  betVersions,
  positions,
  users,
} from "./schema";
import { zurichEndOfDayToUtc } from "../lib/dates";
import { contentHashFor } from "../lib/hash";

async function upsertUser(name: string, email: string) {
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing[0]) return existing[0];
  const [row] = await db.insert(users).values({ name, email }).returning();
  return row;
}

interface SeedPosition {
  userId: string;
  side: "YES" | "NO";
}

interface SeedBet {
  slug: string;
  kind: "FIXED_DATE" | "EVENT_TRIGGERED" | "CONTINGENT";
  finalStatus: "AWAITING_RESOLUTION" | "ACTIVE";
  statement: string;
  terms: string;
  resolutionCriteria: string;
  resolutionDate: Date | null;
  expectedResolutionDate: Date | null;
  longStopDate: Date | null;
  lockedAt: Date;
  createdBy: string;
  positions: SeedPosition[];
  flag?: { action: string; note: string };
}

async function seedBet(spec: SeedBet) {
  const existing = await db.select().from(bets).where(eq(bets.slug, spec.slug));
  if (existing[0]) {
    console.log(`  skip (exists): ${spec.slug}`);
    return;
  }

  await db.transaction(async (tx) => {
    // Insert as PROPOSED first so the positions_insert_window trigger allows
    // taking positions, then lock it — mirrors the real lifecycle instead of
    // faking a pre-locked row directly.
    const [bet] = await tx
      .insert(bets)
      .values({
        slug: spec.slug,
        kind: spec.kind,
        status: "PROPOSED",
        statement: spec.statement,
        terms: spec.terms,
        resolutionCriteria: spec.resolutionCriteria,
        resolutionDate: spec.resolutionDate,
        expectedResolutionDate: spec.expectedResolutionDate,
        longStopDate: spec.longStopDate,
        createdBy: spec.createdBy,
      })
      .returning();

    for (const p of spec.positions) {
      await tx.insert(positions).values({
        betId: bet.id,
        userId: p.userId,
        side: p.side,
        acceptedAt: spec.lockedAt,
      });
    }

    const payload = {
      statement: spec.statement,
      terms: spec.terms,
      kind: spec.kind,
      resolutionCriteria: spec.resolutionCriteria,
      resolutionDate: spec.resolutionDate,
      longStopDate: spec.longStopDate,
      stakeNote: null,
      positions: spec.positions
        .map((p) => ({ userId: p.userId, side: p.side }))
        .sort((a, b) => a.userId.localeCompare(b.userId)),
    };
    const contentHash = contentHashFor(payload);

    await tx
      .update(bets)
      .set({ status: spec.finalStatus, lockedAt: spec.lockedAt, currentVersion: 1 })
      .where(eq(bets.id, bet.id));

    await tx.insert(betVersions).values({
      betId: bet.id,
      version: 1,
      payload,
      contentHash,
      prevHash: null,
      createdBy: spec.createdBy,
      reason: "Initial lock (seed)",
      createdAt: spec.lockedAt,
    });

    await tx.insert(activityLog).values([
      { betId: bet.id, actorId: spec.createdBy, action: "CREATED", createdAt: spec.lockedAt },
      { betId: bet.id, actorId: spec.createdBy, action: "LOCKED", meta: { contentHash }, createdAt: spec.lockedAt },
    ]);

    if (spec.flag) {
      await tx.insert(activityLog).values({
        betId: bet.id,
        actorId: null,
        action: spec.flag.action,
        meta: { note: spec.flag.note },
      });
    }
  });

  console.log(`  created: ${spec.slug}`);
}

async function main() {
  console.log("Seeding users…");
  const ben = await upsertUser("Ben", "apps.gunny.0f@icloud.com");
  const mathis = await upsertUser("Mathis", "mathis.heuss@gmail.com");
  console.log(`  ben=${ben.id} mathis=${mathis.id}`);

  console.log("Seeding bets…");

  await seedBet({
    slug: "starlink-phones",
    kind: "FIXED_DATE",
    finalStatus: "AWAITING_RESOLUTION",
    statement: "Elon delivers the first Starlink phones.",
    terms:
      "Must be a Starlink product — Starlink's own handset hardware. A third-party phone that is merely Starlink-enabled does not count.",
    resolutionCriteria:
      "Resolves YES only if Starlink itself ships a branded handset. A third-party phone with Starlink connectivity built in does not satisfy this.",
    resolutionDate: zurichEndOfDayToUtc("2026-03-31"),
    expectedResolutionDate: null,
    longStopDate: null,
    lockedAt: new Date("2025-01-10T12:00:00Z"),
    createdBy: mathis.id,
    positions: [
      { userId: mathis.id, side: "YES" },
      { userId: ben.id, side: "NO" },
    ],
  });

  await seedBet({
    slug: "autonomous-cars-basel",
    kind: "FIXED_DATE",
    finalStatus: "AWAITING_RESOLUTION",
    statement: "Fully autonomous private cars are legal and operating in Basel.",
    terms: "Level 4 or above. Not a pilot programme. Available to the general public.",
    resolutionCriteria:
      "Resolves YES only if Level 4+ autonomous private cars are legally operating in Basel, available to the general public — not a limited pilot programme.",
    resolutionDate: zurichEndOfDayToUtc("2025-12-31"),
    expectedResolutionDate: null,
    longStopDate: null,
    lockedAt: new Date("2025-01-10T12:00:00Z"),
    createdBy: mathis.id,
    positions: [
      { userId: mathis.id, side: "YES" },
      { userId: ben.id, side: "NO" },
    ],
  });

  await seedBet({
    slug: "apple-headset-price",
    kind: "EVENT_TRIGGERED",
    finalStatus: "AWAITING_RESOLUTION",
    statement:
      "The cheapest configuration of Apple's headset retails above CHF 2,000 in Switzerland at release.",
    terms:
      "Cheapest configuration at Swiss launch, Apple's own retail price, VAT inclusive. Strictly greater than CHF 2,000.",
    resolutionCriteria:
      "Resolves YES only if Apple's own Swiss retail price for the cheapest configuration, VAT inclusive, is strictly greater than CHF 2,000 at release.",
    resolutionDate: null,
    expectedResolutionDate: new Date("2025-06-01T00:00:00Z"),
    longStopDate: null,
    lockedAt: new Date("2025-02-01T12:00:00Z"),
    createdBy: ben.id,
    positions: [
      { userId: ben.id, side: "YES" },
      { userId: mathis.id, side: "NO" },
    ],
    flag: {
      action: "TERMS_AMBIGUITY_FLAGGED",
      note:
        "The trigger has occurred, so this is resolvable — but the terms as originally written don't specify which headset product, which matters if Apple ships more than one. Flagged for the participants rather than decided automatically.",
    },
  });

  await seedBet({
    slug: "zuck-vs-musk",
    kind: "CONTINGENT",
    finalStatus: "ACTIVE",
    statement: "If Zuckerberg and Musk fight, Zuckerberg wins.",
    terms:
      "Undefined at time of agreement — needs a definition of \"fight\". Suggested: a sanctioned or publicly staged bout with an announced result. Lapses VOID at long-stop.",
    resolutionCriteria:
      "Resolves YES only if a sanctioned or publicly staged bout between the two occurs with an announced result, and Zuckerberg is declared the winner. Otherwise VOID at the long-stop date.",
    resolutionDate: null,
    expectedResolutionDate: null,
    longStopDate: zurichEndOfDayToUtc("2027-12-31"),
    lockedAt: new Date("2025-03-01T12:00:00Z"),
    createdBy: ben.id,
    positions: [
      { userId: ben.id, side: "YES" },
      { userId: mathis.id, side: "NO" },
    ],
    flag: {
      action: "TERMS_CLARIFICATION_NEEDED",
      note:
        "\"Fight\" was never defined at agreement time. Suggested definition: a sanctioned or publicly staged bout with an announced result. Needs both parties to confirm or amend via the amendment flow.",
    },
  });

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
