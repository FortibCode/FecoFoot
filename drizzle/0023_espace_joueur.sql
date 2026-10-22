ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'PLAYER';--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "user_id" integer;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "players_user_uq" ON "players" USING btree ("user_id");
