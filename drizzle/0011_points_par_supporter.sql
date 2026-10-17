DROP INDEX "supporter_points_supporter_idx";--> statement-breakpoint
DROP INDEX "supporter_points_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "supporter_points_uq" ON "supporter_points" USING btree ("supporter_id","reason","ref_id");