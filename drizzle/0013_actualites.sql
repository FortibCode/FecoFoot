CREATE TYPE "public"."article_category" AS ENUM('COMMUNIQUE', 'NATIONAL_TEAMS', 'COMPETITIONS', 'CLUBS', 'REFEREEING', 'INSTITUTION');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(200) NOT NULL,
	"title" varchar(200) NOT NULL,
	"summary" varchar(400) NOT NULL,
	"body" text NOT NULL,
	"category" "article_category" NOT NULL,
	"status" "article_status" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"cover_key" varchar(200),
	"cover_type" varchar(32),
	"author_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_slug_uq" ON "articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "articles" USING btree ("status","published_at");