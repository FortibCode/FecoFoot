CREATE TYPE "public"."governance_body_kind" AS ENUM('EXECUTIVE', 'GENERAL_ASSEMBLY', 'JUDICIAL', 'PERMANENT', 'INDEPENDENT', 'OTHER');--> statement-breakpoint
CREATE TABLE "governance_bodies" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"kind" "governance_body_kind" NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"body_id" integer NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"position" varchar(120) NOT NULL,
	"start_date" date,
	"end_date" date,
	"status" "official_status" DEFAULT 'ACTIVE' NOT NULL,
	"source" varchar(200),
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "governance_members" ADD CONSTRAINT "governance_members_body_id_governance_bodies_id_fk" FOREIGN KEY ("body_id") REFERENCES "public"."governance_bodies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_members" ADD CONSTRAINT "governance_members_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "governance_bodies_slug_uq" ON "governance_bodies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "governance_members_body_idx" ON "governance_members" USING btree ("body_id","status");