CREATE TYPE "public"."discipline_case_status" AS ENUM('OPEN', 'DECIDED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."sanction_type" AS ENUM('WARNING', 'MATCH_SUSPENSION', 'TIME_SUSPENSION', 'FINE', 'POINTS_DEDUCTION');--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'DISCIPLINE';--> statement-breakpoint
CREATE SEQUENCE "public"."discipline_case_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "discipline_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(20) NOT NULL,
	"competition_id" integer,
	"match_id" integer,
	"player_id" integer,
	"club_id" integer,
	"facts" text NOT NULL,
	"hearing_at" timestamp with time zone,
	"status" "discipline_case_status" DEFAULT 'OPEN' NOT NULL,
	"decision" text,
	"sanction_type" "sanction_type",
	"suspension_matches" integer,
	"suspension_until" date,
	"fine_amount" integer,
	"points_deducted" integer,
	"decided_at" timestamp with time zone,
	"decided_by" integer,
	"published_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "yellow_card_threshold" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "discipline_cases" ADD CONSTRAINT "discipline_cases_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_cases" ADD CONSTRAINT "discipline_cases_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_cases" ADD CONSTRAINT "discipline_cases_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_cases" ADD CONSTRAINT "discipline_cases_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_cases" ADD CONSTRAINT "discipline_cases_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_cases" ADD CONSTRAINT "discipline_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discipline_cases_number_uq" ON "discipline_cases" USING btree ("number");--> statement-breakpoint
CREATE INDEX "discipline_cases_player_idx" ON "discipline_cases" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "discipline_cases_status_idx" ON "discipline_cases" USING btree ("status");