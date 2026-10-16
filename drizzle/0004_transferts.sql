CREATE TYPE "public"."transfer_status" AS ENUM('PENDING', 'FORWARDED', 'APPROVED', 'REFUSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."transfer_type" AS ENUM('DEFINITIVE', 'LOAN', 'FREE');--> statement-breakpoint
ALTER TYPE "public"."license_status" ADD VALUE 'TRANSFERRED';--> statement-breakpoint
CREATE SEQUENCE "public"."transfer_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(24) NOT NULL,
	"player_id" integer NOT NULL,
	"from_club_id" integer,
	"to_club_id" integer NOT NULL,
	"type" "transfer_type" NOT NULL,
	"fee" integer DEFAULT 0 NOT NULL,
	"loan_end_date" date,
	"season" integer NOT NULL,
	"status" "transfer_status" DEFAULT 'PENDING' NOT NULL,
	"review_opinion" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone,
	"decision_reason" text,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "licenses_player_season_uq";--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_club_id_clubs_id_fk" FOREIGN KEY ("from_club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_club_id_clubs_id_fk" FOREIGN KEY ("to_club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transfers_number_uq" ON "transfers" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "transfers_one_active_uq" ON "transfers" USING btree ("player_id") WHERE "transfers"."status" in ('PENDING', 'FORWARDED');--> statement-breakpoint
CREATE INDEX "transfers_status_idx" ON "transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transfers_to_club_idx" ON "transfers" USING btree ("to_club_id");--> statement-breakpoint
CREATE INDEX "transfers_from_club_idx" ON "transfers" USING btree ("from_club_id");--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_player_season_uq" ON "licenses" USING btree ("player_id","season") WHERE "licenses"."status" in ('PENDING', 'PAID', 'VALIDATED', 'SUSPENDED', 'EXPIRED');