CREATE TYPE "public"."biometric_result" AS ENUM('MATCH', 'NO_MATCH', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."identity_method" AS ENUM('DOCUMENTS', 'BIOMETRIC');--> statement-breakpoint
ALTER TYPE "public"."license_status" ADD VALUE 'TO_CORRECT' BEFORE 'VALIDATED';--> statement-breakpoint
ALTER TYPE "public"."license_status" ADD VALUE 'REVOKED' BEFORE 'EXPIRED';--> statement-breakpoint
CREATE TABLE "biometric_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"license_id" integer,
	"provider" varchar(40) NOT NULL,
	"provider_ref" varchar(120),
	"result" "biometric_result" NOT NULL,
	"context" varchar(60) NOT NULL,
	"checked_by" integer,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biometric_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"provider" varchar(40) NOT NULL,
	"provider_ref" varchar(120) NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"enrolled_by" integer,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "identity_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "identity_verified_by" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "identity_method" "identity_method";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "publish_photo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "show_birth_date" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "biometric_checks" ADD CONSTRAINT "biometric_checks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_checks" ADD CONSTRAINT "biometric_checks_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_checks" ADD CONSTRAINT "biometric_checks_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_enrollments" ADD CONSTRAINT "biometric_enrollments_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_enrollments" ADD CONSTRAINT "biometric_enrollments_enrolled_by_users_id_fk" FOREIGN KEY ("enrolled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "biometric_checks_player_idx" ON "biometric_checks" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "biometric_enrollments_player_idx" ON "biometric_enrollments" USING btree ("player_id");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_identity_verified_by_users_id_fk" FOREIGN KEY ("identity_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;