CREATE TYPE "public"."national_event_side" AS ENUM('CONGO', 'OPPONENT');--> statement-breakpoint
CREATE TYPE "public"."stat_period" AS ENUM('ALL', 'H1', 'H2');--> statement-breakpoint
CREATE TABLE "match_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer,
	"fixture_id" integer,
	"period" "stat_period" DEFAULT 'ALL' NOT NULL,
	"possession_home" integer,
	"shots_home" integer,
	"shots_away" integer,
	"shots_on_target_home" integer,
	"shots_on_target_away" integer,
	"corners_home" integer,
	"corners_away" integer,
	"offsides_home" integer,
	"offsides_away" integer,
	"fouls_home" integer,
	"fouls_away" integer,
	"saves_home" integer,
	"saves_away" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "national_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"fixture_id" integer NOT NULL,
	"type" "match_event_type" NOT NULL,
	"minute" integer NOT NULL,
	"side" "national_event_side" NOT NULL,
	"player" varchar(160) NOT NULL,
	"second_player" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "national_lineups" (
	"id" serial PRIMARY KEY NOT NULL,
	"fixture_id" integer NOT NULL,
	"selection_player_id" integer,
	"player_id" integer,
	"name" varchar(160) NOT NULL,
	"shirt_number" integer,
	"position" "player_position",
	"starter" boolean NOT NULL,
	"captain" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "national_fixtures" ADD COLUMN "formation" varchar(16);--> statement-breakpoint
ALTER TABLE "national_fixtures" ADD COLUMN "lineup_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "match_stats" ADD CONSTRAINT "match_stats_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_stats" ADD CONSTRAINT "match_stats_fixture_id_national_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."national_fixtures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_events" ADD CONSTRAINT "national_events_fixture_id_national_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."national_fixtures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_lineups" ADD CONSTRAINT "national_lineups_fixture_id_national_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."national_fixtures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_lineups" ADD CONSTRAINT "national_lineups_selection_player_id_selection_players_id_fk" FOREIGN KEY ("selection_player_id") REFERENCES "public"."selection_players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_lineups" ADD CONSTRAINT "national_lineups_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_stats_match_uq" ON "match_stats" USING btree ("match_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "match_stats_fixture_uq" ON "match_stats" USING btree ("fixture_id","period");--> statement-breakpoint
CREATE INDEX "national_events_fixture_idx" ON "national_events" USING btree ("fixture_id");--> statement-breakpoint
CREATE INDEX "national_lineups_fixture_idx" ON "national_lineups" USING btree ("fixture_id");