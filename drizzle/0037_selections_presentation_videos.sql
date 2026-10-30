CREATE TABLE "national_team_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"url" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "national_team_id" integer;--> statement-breakpoint
ALTER TABLE "national_teams" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "national_team_videos" ADD CONSTRAINT "national_team_videos_team_id_national_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."national_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "national_team_videos_team_idx" ON "national_team_videos" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_national_team_id_national_teams_id_fk" FOREIGN KEY ("national_team_id") REFERENCES "public"."national_teams"("id") ON DELETE set null ON UPDATE no action;