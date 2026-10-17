CREATE TYPE "public"."accreditation_status" AS ENUM('PENDING', 'APPROVED', 'REFUSED');--> statement-breakpoint
CREATE TYPE "public"."press_role" AS ENUM('JOURNALIST', 'PHOTOGRAPHER', 'CAMERA', 'RADIO', 'TECHNICIAN');--> statement-breakpoint
CREATE TYPE "public"."press_zone" AS ENUM('PRESS_BOX', 'PITCHSIDE', 'MIXED_ZONE', 'PRESS_CONFERENCE');--> statement-breakpoint
CREATE SEQUENCE "public"."accreditation_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "accreditation_quotas" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"zone" "press_zone" NOT NULL,
	"quota" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accreditations" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(16) NOT NULL,
	"event_id" integer NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"first_name" varchar(80) NOT NULL,
	"phone" varchar(16) NOT NULL,
	"email" varchar(255),
	"outlet" varchar(160) NOT NULL,
	"role" "press_role" NOT NULL,
	"press_card_number" varchar(40) NOT NULL,
	"requested_zones" "press_zone"[] NOT NULL,
	"granted_zones" "press_zone"[],
	"status" "accreditation_status" DEFAULT 'PENDING' NOT NULL,
	"decision_reason" text,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"tracking_hash" varchar(64) NOT NULL,
	"badge_token" varchar(64) NOT NULL,
	"entries" integer DEFAULT 0 NOT NULL,
	"last_entry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accreditation_quotas" ADD CONSTRAINT "accreditation_quotas_event_id_ticket_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."ticket_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accreditations" ADD CONSTRAINT "accreditations_event_id_ticket_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."ticket_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accreditations" ADD CONSTRAINT "accreditations_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accreditation_quotas_uq" ON "accreditation_quotas" USING btree ("event_id","zone");--> statement-breakpoint
CREATE UNIQUE INDEX "accreditations_number_uq" ON "accreditations" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "accreditations_event_phone_uq" ON "accreditations" USING btree ("event_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "accreditations_tracking_uq" ON "accreditations" USING btree ("tracking_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "accreditations_badge_uq" ON "accreditations" USING btree ("badge_token");--> statement-breakpoint
CREATE INDEX "accreditations_event_status_idx" ON "accreditations" USING btree ("event_id","status");