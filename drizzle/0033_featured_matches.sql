ALTER TABLE "matches" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "national_fixtures" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;