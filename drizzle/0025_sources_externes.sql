CREATE TYPE "public"."external_provider" AS ENUM('API_FOOTBALL');--> statement-breakpoint
CREATE TYPE "public"."external_link_entity" AS ENUM('competition', 'club', 'match');--> statement-breakpoint
CREATE TYPE "public"."score_source" AS ENUM('OFFICIAL', 'EXTERNAL');--> statement-breakpoint
CREATE TABLE "external_conflicts" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"provider" "external_provider" NOT NULL,
	"official_value" jsonb NOT NULL,
	"external_value" jsonb NOT NULL,
	"reason" text NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" integer,
	"resolution" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "external_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" "external_provider" NOT NULL,
	"entity" "external_link_entity" NOT NULL,
	"entity_id" integer NOT NULL,
	"external_id" varchar(64) NOT NULL,
	"external_season" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" "external_provider" NOT NULL,
	"competition_id" integer,
	"trigger" varchar(20) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"conflicts" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"error" text,
	"notes" jsonb
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "score_source" "score_source" DEFAULT 'OFFICIAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "external_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "external_conflicts" ADD CONSTRAINT "external_conflicts_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_conflicts" ADD CONSTRAINT "external_conflicts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_links" ADD CONSTRAINT "external_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_sync_runs" ADD CONSTRAINT "external_sync_runs_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_conflicts_open_idx" ON "external_conflicts" USING btree ("resolved_at","match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_links_external_uq" ON "external_links" USING btree ("provider","entity","external_id","external_season");--> statement-breakpoint
CREATE UNIQUE INDEX "external_links_entity_uq" ON "external_links" USING btree ("provider","entity","entity_id");--> statement-breakpoint
CREATE INDEX "external_sync_runs_started_idx" ON "external_sync_runs" USING btree ("started_at");