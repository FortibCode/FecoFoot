ALTER TABLE "referees" ADD COLUMN "championship_id" integer;--> statement-breakpoint
ALTER TABLE "referees" ADD CONSTRAINT "referees_championship_id_championships_id_fk" FOREIGN KEY ("championship_id") REFERENCES "public"."championships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Un seul rattachement : ligue départementale ou championnat national.
ALTER TABLE "referees" ADD CONSTRAINT "referees_one_scope_ck" CHECK ("league_id" IS NULL OR "championship_id" IS NULL);
