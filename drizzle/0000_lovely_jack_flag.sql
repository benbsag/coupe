CREATE TYPE "public"."amendment_decision" AS ENUM('APPROVE', 'REJECT');--> statement-breakpoint
CREATE TYPE "public"."amendment_status" AS ENUM('OPEN', 'APPROVED', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."bet_kind" AS ENUM('FIXED_DATE', 'EVENT_TRIGGERED', 'CONTINGENT');--> statement-breakpoint
CREATE TYPE "public"."bet_status" AS ENUM('DRAFT', 'PROPOSED', 'ACTIVE', 'AWAITING_RESOLUTION', 'DISPUTED', 'RESOLVED', 'VOID', 'LAPSED');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'push');--> statement-breakpoint
CREATE TYPE "public"."probability_confidence" AS ENUM('sourced', 'inferred', 'insufficient_evidence');--> statement-breakpoint
CREATE TYPE "public"."resolution_outcome" AS ENUM('YES', 'NO', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."resolution_status" AS ENUM('PROPOSED', 'CONFIRMED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('OWED', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('YES', 'NO');--> statement-breakpoint
CREATE TYPE "public"."tone" AS ENUM('dry', 'rowdy');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amendment_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amendment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"decision" "amendment_decision" NOT NULL,
	"comment" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"proposed_by" uuid NOT NULL,
	"proposed_payload" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" "amendment_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bet_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"prev_hash" varchar(64),
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(160) NOT NULL,
	"kind" "bet_kind" NOT NULL,
	"status" "bet_status" DEFAULT 'DRAFT' NOT NULL,
	"statement" text NOT NULL,
	"terms" text NOT NULL,
	"resolution_criteria" text NOT NULL,
	"resolution_date" timestamp with time zone,
	"expected_resolution_date" timestamp with time zone,
	"long_stop_date" timestamp with time zone,
	"stake_note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"current_version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"threshold_label" text,
	"channel" "notification_channel" NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"dedupe_key" varchar(300) NOT NULL,
	"payload" jsonb,
	"error" text,
	CONSTRAINT "notifications_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"side" "side" NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "probability_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"probability" numeric(5, 4),
	"confidence" "probability_confidence" NOT NULL,
	"rationale" text,
	"sources" jsonb,
	"model" text
);
--> statement-breakpoint
CREATE TABLE "resolution_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resolution_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"agree" boolean NOT NULL,
	"comment" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"proposed_outcome" "resolution_outcome" NOT NULL,
	"proposed_by" uuid NOT NULL,
	"evidence_url" text,
	"evidence_note" text,
	"status" "resolution_status" DEFAULT 'PROPOSED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"debtor_id" uuid NOT NULL,
	"creditor_id" uuid NOT NULL,
	"status" "settlement_status" DEFAULT 'OWED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_marked_by" uuid,
	"paid_note" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(32),
	"timezone" text DEFAULT 'Europe/Zurich' NOT NULL,
	"notify_email" boolean DEFAULT true NOT NULL,
	"notify_sms" boolean DEFAULT false NOT NULL,
	"notify_push" boolean DEFAULT false NOT NULL,
	"tone" "tone" DEFAULT 'rowdy' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendment_votes" ADD CONSTRAINT "amendment_votes_amendment_id_amendments_id_fk" FOREIGN KEY ("amendment_id") REFERENCES "public"."amendments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendment_votes" ADD CONSTRAINT "amendment_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_versions" ADD CONSTRAINT "bet_versions_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_versions" ADD CONSTRAINT "bet_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probability_snapshots" ADD CONSTRAINT "probability_snapshots_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolution_votes" ADD CONSTRAINT "resolution_votes_resolution_id_resolutions_id_fk" FOREIGN KEY ("resolution_id") REFERENCES "public"."resolutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolution_votes" ADD CONSTRAINT "resolution_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_debtor_id_users_id_fk" FOREIGN KEY ("debtor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_creditor_id_users_id_fk" FOREIGN KEY ("creditor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_paid_marked_by_users_id_fk" FOREIGN KEY ("paid_marked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amendment_votes_amendment_id_user_id_idx" ON "amendment_votes" USING btree ("amendment_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bet_versions_bet_id_version_idx" ON "bet_versions" USING btree ("bet_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_bet_id_user_id_idx" ON "positions" USING btree ("bet_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resolution_votes_resolution_id_user_id_idx" ON "resolution_votes" USING btree ("resolution_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_bet_debtor_creditor_idx" ON "settlements" USING btree ("bet_id","debtor_id","creditor_id");