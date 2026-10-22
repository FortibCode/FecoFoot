CREATE TYPE "public"."official_status" AS ENUM('ACTIVE', 'ENDED');--> statement-breakpoint
CREATE TYPE "public"."team_outcome" AS ENUM('CHAMPION', 'PROMOTED', 'MAINTAINED', 'RELEGATED', 'WITHDRAWN', 'EXCLUDED');--> statement-breakpoint
CREATE TABLE "championship_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"championship_id" integer NOT NULL,
	"season" integer,
	"title" varchar(200) NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"content_type" varchar(64) NOT NULL,
	"size" integer NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "championship_officials" (
	"id" serial PRIMARY KEY NOT NULL,
	"championship_id" integer,
	"full_name" varchar(160) NOT NULL,
	"position" varchar(120) NOT NULL,
	"email" varchar(255),
	"phone" varchar(32),
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "official_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "championships" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(120) NOT NULL,
	"tier" integer NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competition_teams" ADD COLUMN "outcome" "team_outcome";--> statement-breakpoint
ALTER TABLE "competition_teams" ADD COLUMN "registered_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "championship_id" integer;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "promotion_spots" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "relegation_spots" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "championship_documents" ADD CONSTRAINT "championship_documents_championship_id_championships_id_fk" FOREIGN KEY ("championship_id") REFERENCES "public"."championships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_documents" ADD CONSTRAINT "championship_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_officials" ADD CONSTRAINT "championship_officials_championship_id_championships_id_fk" FOREIGN KEY ("championship_id") REFERENCES "public"."championships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_officials" ADD CONSTRAINT "championship_officials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "championship_documents_idx" ON "championship_documents" USING btree ("championship_id","season");--> statement-breakpoint
CREATE INDEX "championship_officials_idx" ON "championship_officials" USING btree ("championship_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "championships_code_uq" ON "championships" USING btree ("code");--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_championship_id_championships_id_fk" FOREIGN KEY ("championship_id") REFERENCES "public"."championships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_championship_season_uq" ON "competitions" USING btree ("championship_id","season");--> statement-breakpoint
-- Données de référence : les deux championnats nationaux (structures permanentes, sans club ni saison inventés).
INSERT INTO "championships" ("code", "name", "tier", "description") VALUES
  ('ligue-1', 'Ligue 1', 1, 'Championnat national de première division.'),
  ('ligue-2', 'Ligue 2', 2, 'Championnat national de deuxième division.')
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
-- Saisons existantes : rattachées à leur championnat d'après leur nom (compétitions nationales seulement).
UPDATE "competitions" c SET "championship_id" = ch."id"
FROM "championships" ch
WHERE c."league_id" IS NULL AND c."championship_id" IS NULL AND c."type" = 'LEAGUE'
  AND ((ch."code" = 'ligue-1' AND c."name" IN ('Ligue 1', 'Ligue 1 National'))
    OR (ch."code" = 'ligue-2' AND c."name" IN ('Ligue 2', 'Ligue 2 National')));
