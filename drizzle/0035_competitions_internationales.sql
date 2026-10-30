CREATE TABLE "intl_competitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"season" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intl_group_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"matchday" integer NOT NULL,
	"home" varchar(120) NOT NULL,
	"away" varchar(120) NOT NULL,
	"kickoff_at" timestamp with time zone,
	"venue" varchar(160),
	"home_goals" integer,
	"away_goals" integer,
	"status" "national_fixture_status" DEFAULT 'SCHEDULED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intl_group_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"country" varchar(120) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intl_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(80) NOT NULL,
	"qualifiers" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "national_fixtures" ADD COLUMN "group_id" integer;--> statement-breakpoint
ALTER TABLE "national_fixtures" ADD COLUMN "matchday" integer;--> statement-breakpoint
ALTER TABLE "intl_group_matches" ADD CONSTRAINT "intl_group_matches_group_id_intl_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."intl_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intl_group_teams" ADD CONSTRAINT "intl_group_teams_group_id_intl_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."intl_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intl_groups" ADD CONSTRAINT "intl_groups_competition_id_intl_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."intl_competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intl_groups" ADD CONSTRAINT "intl_groups_team_id_national_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."national_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intl_group_matches_idx" ON "intl_group_matches" USING btree ("group_id","matchday");--> statement-breakpoint
CREATE UNIQUE INDEX "intl_group_teams_uq" ON "intl_group_teams" USING btree ("group_id","country");--> statement-breakpoint
CREATE UNIQUE INDEX "intl_groups_uq" ON "intl_groups" USING btree ("competition_id","name");--> statement-breakpoint
ALTER TABLE "national_fixtures" ADD CONSTRAINT "national_fixtures_group_id_intl_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."intl_groups"("id") ON DELETE set null ON UPDATE no action;