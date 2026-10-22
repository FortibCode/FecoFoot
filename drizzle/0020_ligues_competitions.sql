CREATE TYPE "public"."competition_category" AS ENUM('U13', 'U15', 'U17', 'U20', 'U23', 'SENIOR', 'VETERAN');--> statement-breakpoint
ALTER TYPE "public"."match_event_type" ADD VALUE 'SUBSTITUTION';--> statement-breakpoint
ALTER TYPE "public"."match_status" ADD VALUE 'HALF_TIME' BEFORE 'FINISHED';--> statement-breakpoint
ALTER TYPE "public"."match_status" ADD VALUE 'SUSPENDED' BEFORE 'CANCELLED';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'COMPETITION_MANAGER';--> statement-breakpoint
ALTER TABLE "competitions" ALTER COLUMN "category" SET DATA TYPE "public"."competition_category" USING "category"::text::"public"."competition_category";--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "league_id" integer;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "tiebreakers" text[] DEFAULT '{GOAL_DIFF,GOALS_FOR}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "department" varchar(80);--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "logo_key" varchar(255);--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "logo_type" varchar(64);--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "match_events" ADD COLUMN "player_in_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "validated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "validated_by" integer;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_player_in_id_players_id_fk" FOREIGN KEY ("player_in_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_validated_by_users_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competitions_league_idx" ON "competitions" USING btree ("league_id");--> statement-breakpoint
-- Données : les 11 ligues départementales (noms officiels), sans doublon et sans écraser un nom déjà modifié.
INSERT INTO "leagues" ("code", "name", "department") VALUES
  ('BOU', 'Ligue départementale de la Bouenza', 'Bouenza'),
  ('BZV', 'Ligue départementale de Brazzaville', 'Brazzaville'),
  ('CUV', 'Ligue départementale de la Cuvette', 'Cuvette'),
  ('CUO', 'Ligue départementale de la Cuvette-Ouest', 'Cuvette-Ouest'),
  ('KOU', 'Ligue départementale du Kouilou', 'Kouilou'),
  ('LEK', 'Ligue départementale de la Lékoumou', 'Lékoumou'),
  ('LIK', 'Ligue départementale de la Likouala', 'Likouala'),
  ('NIA', 'Ligue départementale du Niari', 'Niari'),
  ('PLA', 'Ligue départementale des Plateaux', 'Plateaux'),
  ('POO', 'Ligue départementale du Pool', 'Pool'),
  ('SAN', 'Ligue départementale de la Sangha', 'Sangha')
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
UPDATE "leagues" l SET "name" = v.official, "updated_at" = now()
FROM (VALUES
  ('BOU', 'Ligue de la Bouenza', 'Ligue départementale de la Bouenza'),
  ('BZV', 'Ligue de Brazzaville', 'Ligue départementale de Brazzaville'),
  ('CUV', 'Ligue de la Cuvette', 'Ligue départementale de la Cuvette'),
  ('CUO', 'Ligue de la Cuvette-Ouest', 'Ligue départementale de la Cuvette-Ouest'),
  ('KOU', 'Ligue du Kouilou', 'Ligue départementale du Kouilou'),
  ('LEK', 'Ligue de la Lékoumou', 'Ligue départementale de la Lékoumou'),
  ('LIK', 'Ligue de la Likouala', 'Ligue départementale de la Likouala'),
  ('NIA', 'Ligue du Niari', 'Ligue départementale du Niari'),
  ('PLA', 'Ligue des Plateaux', 'Ligue départementale des Plateaux'),
  ('POO', 'Ligue du Pool', 'Ligue départementale du Pool'),
  ('SAN', 'Ligue de la Sangha', 'Ligue départementale de la Sangha')
) AS v(code, old_name, official)
WHERE l."code" = v.code AND l."name" = v.old_name;--> statement-breakpoint
UPDATE "leagues" l SET "department" = v.department
FROM (VALUES ('BOU', 'Bouenza'), ('BZV', 'Brazzaville'), ('CUV', 'Cuvette'), ('CUO', 'Cuvette-Ouest'), ('KOU', 'Kouilou'), ('LEK', 'Lékoumou'),
  ('LIK', 'Likouala'), ('NIA', 'Niari'), ('PLA', 'Plateaux'), ('POO', 'Pool'), ('SAN', 'Sangha'), ('PNR', 'Pointe-Noire')) AS v(code, department)
WHERE l."code" = v.code AND l."department" IS NULL;--> statement-breakpoint
-- Les résultats déjà terminés restent officiels : le classement actuel ne change pas.
UPDATE "matches" SET "validated_at" = "updated_at" WHERE "status" = 'FINISHED' AND "validated_at" IS NULL;
