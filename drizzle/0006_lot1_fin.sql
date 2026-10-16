CREATE TABLE "transfer_windows" (
	"id" serial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"name" varchar(80) NOT NULL,
	"opens_on" date NOT NULL,
	"closes_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "release_granted" boolean;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "release_reason" text;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "release_by" integer;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "release_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_last_step" integer;--> statement-breakpoint
CREATE INDEX "transfer_windows_season_idx" ON "transfer_windows" USING btree ("season");--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_release_by_users_id_fk" FOREIGN KEY ("release_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;