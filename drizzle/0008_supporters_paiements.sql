CREATE TYPE "public"."id_document_type" AS ENUM('CNI', 'PASSPORT', 'RESIDENCE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('PENDING', 'ACTIVE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."membership_tier" AS ENUM('ADULT', 'YOUTH');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('AIRTEL_MONEY', 'MTN_MOMO', 'CASH');--> statement-breakpoint
CREATE TYPE "public"."payment_purpose" AS ENUM('MEMBERSHIP', 'TICKET_ORDER', 'LICENSE_FEE');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'REFUNDED');--> statement-breakpoint
CREATE SEQUENCE "public"."fan_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"tier" "membership_tier" NOT NULL,
	"price" integer NOT NULL,
	"open" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"supporter_id" integer NOT NULL,
	"season" integer NOT NULL,
	"tier" "membership_tier" NOT NULL,
	"price" integer NOT NULL,
	"status" "membership_status" DEFAULT 'PENDING' NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" varchar(32) NOT NULL,
	"purpose" "payment_purpose" NOT NULL,
	"target_id" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"phone" varchar(16) NOT NULL,
	"amount" integer NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"provider_ref" varchar(64),
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "supporter_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"supporter_id" integer NOT NULL,
	"points" integer NOT NULL,
	"reason" varchar(32) NOT NULL,
	"ref_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supporters" (
	"id" serial PRIMARY KEY NOT NULL,
	"fan_id" varchar(16) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"first_name" varchar(80) NOT NULL,
	"birth_date" date NOT NULL,
	"phone" varchar(16) NOT NULL,
	"email" varchar(255),
	"password_hash" text NOT NULL,
	"id_document_type" "id_document_type" NOT NULL,
	"id_document_number" varchar(40) NOT NULL,
	"id_verified_at" timestamp with time zone,
	"consent_at" timestamp with time zone NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"banned_at" timestamp with time zone,
	"banned_by" integer,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"session_version" integer DEFAULT 1 NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_supporter_id_supporters_id_fk" FOREIGN KEY ("supporter_id") REFERENCES "public"."supporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supporter_points" ADD CONSTRAINT "supporter_points_supporter_id_supporters_id_fk" FOREIGN KEY ("supporter_id") REFERENCES "public"."supporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supporters" ADD CONSTRAINT "supporters_banned_by_users_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supporters" ADD CONSTRAINT "supporters_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "membership_plans_uq" ON "membership_plans" USING btree ("season","tier");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_active_uq" ON "memberships" USING btree ("supporter_id","season") WHERE "memberships"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "memberships_supporter_idx" ON "memberships" USING btree ("supporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_reference_uq" ON "payments" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "payments_target_idx" ON "payments" USING btree ("purpose","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supporter_points_uq" ON "supporter_points" USING btree ("reason","ref_id");--> statement-breakpoint
CREATE INDEX "supporter_points_supporter_idx" ON "supporter_points" USING btree ("supporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supporters_fan_id_uq" ON "supporters" USING btree ("fan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supporters_phone_uq" ON "supporters" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "supporters_id_document_uq" ON "supporters" USING btree ("id_document_type","id_document_number");--> statement-breakpoint
CREATE INDEX "supporters_name_idx" ON "supporters" USING btree ("last_name","first_name");