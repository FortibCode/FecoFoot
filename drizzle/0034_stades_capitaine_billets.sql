CREATE TABLE "stadiums" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"city" varchar(120) NOT NULL,
	"address" varchar(255),
	"capacity" integer,
	"surface" varchar(40),
	"opened_year" integer,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_lineups" ADD COLUMN "captain" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "stadium_id" integer;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD COLUMN "match_id" integer;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD COLUMN "national_fixture_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "stadiums_name_city_uq" ON "stadiums" USING btree ("name","city");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_stadium_id_stadiums_id_fk" FOREIGN KEY ("stadium_id") REFERENCES "public"."stadiums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_national_fixture_id_national_fixtures_id_fk" FOREIGN KEY ("national_fixture_id") REFERENCES "public"."national_fixtures"("id") ON DELETE set null ON UPDATE no action;