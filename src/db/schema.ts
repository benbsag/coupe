import {
  pgEnum,
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---- enums --------------------------------------------------------------

export const toneEnum = pgEnum("tone", ["dry", "rowdy"]);

export const betKindEnum = pgEnum("bet_kind", [
  "FIXED_DATE",
  "EVENT_TRIGGERED",
  "CONTINGENT",
]);

export const betStatusEnum = pgEnum("bet_status", [
  "DRAFT",
  "PROPOSED",
  "ACTIVE",
  "AWAITING_RESOLUTION",
  "DISPUTED",
  "RESOLVED",
  "VOID",
  "LAPSED",
]);

export const sideEnum = pgEnum("side", ["YES", "NO"]);

export const amendmentStatusEnum = pgEnum("amendment_status", [
  "OPEN",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
]);

export const amendmentDecisionEnum = pgEnum("amendment_decision", [
  "APPROVE",
  "REJECT",
]);

export const resolutionOutcomeEnum = pgEnum("resolution_outcome", [
  "YES",
  "NO",
  "VOID",
]);

export const resolutionStatusEnum = pgEnum("resolution_status", [
  "PROPOSED",
  "CONFIRMED",
  "DISPUTED",
]);

export const settlementStatusEnum = pgEnum("settlement_status", [
  "OWED",
  "PAID",
]);

export const probabilityConfidenceEnum = pgEnum("probability_confidence", [
  "sourced",
  "inferred",
  "insufficient_evidence",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "sms",
  "push",
]);

// ---- tables ---------------------------------------------------------------

// Auth.js magic-link token storage. Not part of the §11 domain model —
// purely plumbing for the invite-only email sign-in flow.
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  phone: varchar("phone", { length: 32 }),
  timezone: text("timezone").notNull().default("Europe/Zurich"),
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifySms: boolean("notify_sms").notNull().default(false),
  notifyPush: boolean("notify_push").notNull().default(false),
  tone: toneEnum("tone").notNull().default("rowdy"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bets = pgTable("bets", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  kind: betKindEnum("kind").notNull(),
  status: betStatusEnum("status").notNull().default("DRAFT"),

  statement: text("statement").notNull(),
  terms: text("terms").notNull(),
  resolutionCriteria: text("resolution_criteria").notNull(),

  resolutionDate: timestamp("resolution_date", { withTimezone: true }),
  expectedResolutionDate: timestamp("expected_resolution_date", {
    withTimezone: true,
  }),
  longStopDate: timestamp("long_stop_date", { withTimezone: true }),

  stakeNote: text("stake_note"),

  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  currentVersion: integer("current_version").notNull().default(0),
});

export const betVersions = pgTable(
  "bet_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    betId: uuid("bet_id")
      .notNull()
      .references(() => bets.id),
    version: integer("version").notNull(),
    payload: jsonb("payload").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    prevHash: varchar("prev_hash", { length: 64 }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reason: text("reason"),
  },
  (t) => [uniqueIndex("bet_versions_bet_id_version_idx").on(t.betId, t.version)]
);

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    betId: uuid("bet_id")
      .notNull()
      .references(() => bets.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    side: sideEnum("side").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("positions_bet_id_user_id_idx").on(t.betId, t.userId)]
);

export const amendments = pgTable("amendments", {
  id: uuid("id").primaryKey().defaultRandom(),
  betId: uuid("bet_id")
    .notNull()
    .references(() => bets.id),
  proposedBy: uuid("proposed_by")
    .notNull()
    .references(() => users.id),
  proposedPayload: jsonb("proposed_payload").notNull(),
  reason: text("reason").notNull(),
  status: amendmentStatusEnum("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const amendmentVotes = pgTable(
  "amendment_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    amendmentId: uuid("amendment_id")
      .notNull()
      .references(() => amendments.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    decision: amendmentDecisionEnum("decision").notNull(),
    comment: text("comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("amendment_votes_amendment_id_user_id_idx").on(
      t.amendmentId,
      t.userId
    ),
  ]
);

export const resolutions = pgTable("resolutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  betId: uuid("bet_id")
    .notNull()
    .references(() => bets.id),
  proposedOutcome: resolutionOutcomeEnum("proposed_outcome").notNull(),
  proposedBy: uuid("proposed_by")
    .notNull()
    .references(() => users.id),
  evidenceUrl: text("evidence_url"),
  evidenceNote: text("evidence_note"),
  status: resolutionStatusEnum("status").notNull().default("PROPOSED"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});

export const resolutionVotes = pgTable(
  "resolution_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resolutionId: uuid("resolution_id")
      .notNull()
      .references(() => resolutions.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    agree: boolean("agree").notNull(),
    comment: text("comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("resolution_votes_resolution_id_user_id_idx").on(
      t.resolutionId,
      t.userId
    ),
  ]
);

export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    betId: uuid("bet_id")
      .notNull()
      .references(() => bets.id),
    debtorId: uuid("debtor_id")
      .notNull()
      .references(() => users.id),
    creditorId: uuid("creditor_id")
      .notNull()
      .references(() => users.id),
    status: settlementStatusEnum("status").notNull().default("OWED"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidMarkedBy: uuid("paid_marked_by").references(() => users.id),
    paidNote: text("paid_note"),
  },
  (t) => [
    uniqueIndex("settlements_bet_debtor_creditor_idx").on(
      t.betId,
      t.debtorId,
      t.creditorId
    ),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    betId: uuid("bet_id")
      .notNull()
      .references(() => bets.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(),
    thresholdLabel: text("threshold_label"),
    channel: notificationChannelEnum("channel").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    dedupeKey: varchar("dedupe_key", { length: 300 }).notNull().unique(),
    payload: jsonb("payload"),
    error: text("error"),
  }
);

export const probabilitySnapshots = pgTable("probability_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  betId: uuid("bet_id")
    .notNull()
    .references(() => bets.id),
  takenAt: timestamp("taken_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  probability: numeric("probability", { precision: 5, scale: 4 }),
  confidence: probabilityConfidenceEnum("confidence").notNull(),
  rationale: text("rationale"),
  sources: jsonb("sources"),
  model: text("model"),
});

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  betId: uuid("bet_id")
    .notNull()
    .references(() => bets.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  betId: uuid("bet_id")
    .notNull()
    .references(() => bets.id),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- relations (for query ergonomics) -------------------------------------

export const betsRelations = relations(bets, ({ many, one }) => ({
  versions: many(betVersions),
  positions: many(positions),
  amendments: many(amendments),
  resolutions: many(resolutions),
  settlements: many(settlements),
  comments: many(comments),
  activity: many(activityLog),
  creator: one(users, { fields: [bets.createdBy], references: [users.id] }),
}));

export const positionsRelations = relations(positions, ({ one }) => ({
  bet: one(bets, { fields: [positions.betId], references: [bets.id] }),
  user: one(users, { fields: [positions.userId], references: [users.id] }),
}));

export const betVersionsRelations = relations(betVersions, ({ one }) => ({
  bet: one(bets, { fields: [betVersions.betId], references: [bets.id] }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  bet: one(bets, { fields: [activityLog.betId], references: [bets.id] }),
  actor: one(users, { fields: [activityLog.actorId], references: [users.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  bet: one(bets, { fields: [comments.betId], references: [bets.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
}));

export const amendmentsRelations = relations(amendments, ({ one, many }) => ({
  bet: one(bets, { fields: [amendments.betId], references: [bets.id] }),
  proposer: one(users, {
    fields: [amendments.proposedBy],
    references: [users.id],
  }),
  votes: many(amendmentVotes),
}));

export const amendmentVotesRelations = relations(amendmentVotes, ({ one }) => ({
  amendment: one(amendments, {
    fields: [amendmentVotes.amendmentId],
    references: [amendments.id],
  }),
  user: one(users, { fields: [amendmentVotes.userId], references: [users.id] }),
}));

export const resolutionsRelations = relations(resolutions, ({ one, many }) => ({
  bet: one(bets, { fields: [resolutions.betId], references: [bets.id] }),
  proposer: one(users, {
    fields: [resolutions.proposedBy],
    references: [users.id],
  }),
  votes: many(resolutionVotes),
}));

export const resolutionVotesRelations = relations(resolutionVotes, ({ one }) => ({
  resolution: one(resolutions, {
    fields: [resolutionVotes.resolutionId],
    references: [resolutions.id],
  }),
  user: one(users, { fields: [resolutionVotes.userId], references: [users.id] }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
  bet: one(bets, { fields: [settlements.betId], references: [bets.id] }),
  debtor: one(users, {
    fields: [settlements.debtorId],
    references: [users.id],
  }),
  creditor: one(users, {
    fields: [settlements.creditorId],
    references: [users.id],
  }),
  paidMarker: one(users, {
    fields: [settlements.paidMarkedBy],
    references: [users.id],
  }),
}));
