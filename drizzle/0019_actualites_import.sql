ALTER TYPE "public"."article_category" ADD VALUE 'TECHNICAL';--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "source_url" varchar(500);--> statement-breakpoint
CREATE UNIQUE INDEX "articles_source_uq" ON "articles" USING btree ("source_url");