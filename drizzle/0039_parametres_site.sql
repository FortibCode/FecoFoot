CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"founded_year" integer,
	"headquarters" varchar(240),
	"affiliations" varchar(160),
	"facebook_url" varchar(300),
	"instagram_url" varchar(300),
	"x_url" varchar(300),
	"youtube_url" varchar(300),
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "national_teams" ADD COLUMN "tagline" varchar(120);--> statement-breakpoint
ALTER TABLE "national_teams" ADD COLUMN "short_label" varchar(16);--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Valeurs affichées jusqu'ici par le portail (désormais modifiables dans l'administration).
INSERT INTO "site_settings" ("id", "founded_year", "headquarters", "affiliations", "facebook_url", "instagram_url", "x_url", "youtube_url")
VALUES (1, 1962, '2, rue de la Libération de Paris, Poto-Poto 2, Brazzaville', 'FIFA · CAF · UNIFFAC', 'https://www.facebook.com/fecofootcg', 'https://www.instagram.com/fecofoot_rc', 'https://x.com/fecofoot_cg', 'https://www.youtube.com/channel/UCmOWGzjrFxOh36xvlYGmWIg')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
UPDATE "national_teams" SET "tagline" = 'Équipe première', "short_label" = 'A' WHERE "slug" = 'a';--> statement-breakpoint
UPDATE "national_teams" SET "tagline" = 'Joueurs du championnat national', "short_label" = 'A''' WHERE "slug" = 'a-locaux';--> statement-breakpoint
UPDATE "national_teams" SET "tagline" = 'Moins de 23 ans', "short_label" = 'U-23' WHERE "slug" = 'u23';--> statement-breakpoint
UPDATE "national_teams" SET "tagline" = 'Moins de 20 ans', "short_label" = 'U-20' WHERE "slug" = 'u20';--> statement-breakpoint
UPDATE "national_teams" SET "tagline" = 'Moins de 17 ans', "short_label" = 'U-17' WHERE "slug" = 'u17';--> statement-breakpoint
UPDATE "national_teams" SET "tagline" = 'Moins de 15 ans', "short_label" = 'U-15' WHERE "slug" = 'u15';--> statement-breakpoint
UPDATE "national_teams" SET "tagline" = 'Équipe féminine', "short_label" = 'Dames' WHERE "slug" = 'dames';
