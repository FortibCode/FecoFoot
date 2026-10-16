CREATE TYPE "public"."competition_gender" AS ENUM('M', 'F');--> statement-breakpoint
CREATE TYPE "public"."competition_status" AS ENUM('DRAFT', 'ONGOING', 'FINISHED');--> statement-breakpoint
CREATE TYPE "public"."competition_type" AS ENUM('LEAGUE', 'CUP');--> statement-breakpoint
CREATE TYPE "public"."national_fixture_status" AS ENUM('SCHEDULED', 'PLAYED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."match_event_type" AS ENUM('GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'RED_CARD');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."national_team_code" AS ENUM('A', 'A_LOCAL', 'U23', 'U20', 'U17', 'WOMEN');--> statement-breakpoint
CREATE TYPE "public"."official_role" AS ENUM('REFEREE', 'ASSISTANT_1', 'ASSISTANT_2', 'FOURTH_OFFICIAL', 'COMMISSIONER');--> statement-breakpoint
CREATE TYPE "public"."referee_grade" AS ENUM('FIFA', 'ELITE', 'NATIONAL', 'LEAGUE', 'TRAINEE');--> statement-breakpoint
CREATE TYPE "public"."selection_status" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'REFEREE';--> statement-breakpoint
CREATE TABLE "competition_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"club_id" integer NOT NULL,
	"pool" varchar(8),
	"points_penalty" integer DEFAULT 0 NOT NULL,
	"penalty_reason" text,
	"draw_order" integer
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"season" integer NOT NULL,
	"category" "age_category" NOT NULL,
	"gender" "competition_gender" DEFAULT 'M' NOT NULL,
	"type" "competition_type" NOT NULL,
	"status" "competition_status" DEFAULT 'DRAFT' NOT NULL,
	"double_round" boolean DEFAULT true NOT NULL,
	"points_win" integer DEFAULT 3 NOT NULL,
	"points_draw" integer DEFAULT 1 NOT NULL,
	"points_loss" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"type" "match_event_type" NOT NULL,
	"minute" integer NOT NULL,
	"club_id" integer NOT NULL,
	"player_id" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_lineups" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"club_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"starter" boolean NOT NULL,
	"shirt_number" integer
);
--> statement-breakpoint
CREATE TABLE "match_officials" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"referee_id" integer NOT NULL,
	"role" "official_role" NOT NULL,
	"match_day" date NOT NULL,
	"report" text,
	"report_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"round" integer NOT NULL,
	"pool" varchar(8),
	"bracket_slot" integer,
	"home_club_id" integer,
	"away_club_id" integer,
	"kickoff_at" timestamp with time zone,
	"venue" varchar(160),
	"status" "match_status" DEFAULT 'SCHEDULED' NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"home_penalties" integer,
	"away_penalties" integer,
	"attendance" integer,
	"report" text,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "national_fixtures" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"opponent" varchar(120) NOT NULL,
	"kickoff_at" timestamp with time zone NOT NULL,
	"venue" varchar(160),
	"competition" varchar(160),
	"is_home" boolean DEFAULT true NOT NULL,
	"goals_for" integer,
	"goals_against" integer,
	"status" "national_fixture_status" DEFAULT 'SCHEDULED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "national_staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"role" varchar(80) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "national_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" "national_team_code" NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(40) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referees" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"first_name" varchar(80) NOT NULL,
	"grade" "referee_grade" NOT NULL,
	"league_id" integer,
	"phone" varchar(32),
	"email" varchar(255),
	"active" boolean DEFAULT true NOT NULL,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "selection_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"selection_id" integer NOT NULL,
	"player_id" integer,
	"external_name" varchar(160),
	"external_club" varchar(160),
	"external_country" varchar(80),
	"position" "player_position",
	"shirt_number" integer
);
--> statement-breakpoint
CREATE TABLE "selections" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"purpose" text,
	"gathering_date" date,
	"location" varchar(160),
	"status" "selection_status" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_officials" ADD CONSTRAINT "match_officials_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_officials" ADD CONSTRAINT "match_officials_referee_id_referees_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."referees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_club_id_clubs_id_fk" FOREIGN KEY ("home_club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_club_id_clubs_id_fk" FOREIGN KEY ("away_club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_fixtures" ADD CONSTRAINT "national_fixtures_team_id_national_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."national_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_staff" ADD CONSTRAINT "national_staff_team_id_national_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."national_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referees" ADD CONSTRAINT "referees_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referees" ADD CONSTRAINT "referees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_players" ADD CONSTRAINT "selection_players_selection_id_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."selections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_players" ADD CONSTRAINT "selection_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selections" ADD CONSTRAINT "selections_team_id_national_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."national_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selections" ADD CONSTRAINT "selections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competition_teams_uq" ON "competition_teams" USING btree ("competition_id","club_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_slug_uq" ON "competitions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "competitions_season_idx" ON "competitions" USING btree ("season");--> statement-breakpoint
CREATE INDEX "match_events_match_idx" ON "match_events" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_events_player_idx" ON "match_events" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_lineups_player_uq" ON "match_lineups" USING btree ("match_id","player_id");--> statement-breakpoint
CREATE INDEX "match_lineups_club_idx" ON "match_lineups" USING btree ("match_id","club_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_officials_role_uq" ON "match_officials" USING btree ("match_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "match_officials_referee_match_uq" ON "match_officials" USING btree ("match_id","referee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_officials_referee_day_uq" ON "match_officials" USING btree ("referee_id","match_day");--> statement-breakpoint
CREATE INDEX "matches_competition_idx" ON "matches" USING btree ("competition_id","round");--> statement-breakpoint
CREATE INDEX "matches_kickoff_idx" ON "matches" USING btree ("kickoff_at");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_bracket_uq" ON "matches" USING btree ("competition_id","round","bracket_slot");--> statement-breakpoint
CREATE INDEX "national_fixtures_team_idx" ON "national_fixtures" USING btree ("team_id","kickoff_at");--> statement-breakpoint
CREATE INDEX "national_staff_team_idx" ON "national_staff" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "national_teams_code_uq" ON "national_teams" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "national_teams_slug_uq" ON "national_teams" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "referees_user_uq" ON "referees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "referees_name_idx" ON "referees" USING btree ("last_name");--> statement-breakpoint
CREATE UNIQUE INDEX "selection_players_player_uq" ON "selection_players" USING btree ("selection_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "selection_players_shirt_uq" ON "selection_players" USING btree ("selection_id","shirt_number");--> statement-breakpoint
CREATE INDEX "selections_team_idx" ON "selections" USING btree ("team_id","status");