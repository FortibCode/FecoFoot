CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer,
	"caption" varchar(200) DEFAULT '' NOT NULL,
	"credit" varchar(120) DEFAULT 'Équipe nationale du Congo' NOT NULL,
	"storage_key" varchar(200) NOT NULL,
	"mime_type" varchar(32) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_team_id_national_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."national_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photos_team_idx" ON "photos" USING btree ("team_id","published");--> statement-breakpoint
CREATE INDEX "photos_featured_idx" ON "photos" USING btree ("featured","published");