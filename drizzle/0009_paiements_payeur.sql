ALTER TABLE "payments" ADD COLUMN "supporter_id" integer;--> statement-breakpoint
CREATE INDEX "payments_supporter_idx" ON "payments" USING btree ("supporter_id");