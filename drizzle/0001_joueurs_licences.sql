CREATE TYPE "public"."age_category" AS ENUM('U13', 'U15', 'U17', 'U20', 'SENIOR', 'VETERAN');--> statement-breakpoint
CREATE TYPE "public"."consent_recipient" AS ENUM('PLAYER', 'GUARDIAN');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('PENDING', 'ACCEPTED', 'REFUSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('M', 'F');--> statement-breakpoint
CREATE TYPE "public"."license_status" AS ENUM('PENDING', 'PAID', 'VALIDATED', 'REJECTED', 'SUSPENDED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."license_type" AS ENUM('AMATEUR', 'PRO');--> statement-breakpoint
CREATE TYPE "public"."player_position" AS ENUM('GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD');--> statement-breakpoint
CREATE SEQUENCE "public"."license_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."player_federal_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(24) NOT NULL,
	"player_id" integer NOT NULL,
	"club_id" integer NOT NULL,
	"season" integer NOT NULL,
	"category" "age_category" NOT NULL,
	"type" "license_type" DEFAULT 'AMATEUR' NOT NULL,
	"status" "license_status" DEFAULT 'PENDING' NOT NULL,
	"medical_check_date" date NOT NULL,
	"fee_amount" integer NOT NULL,
	"paid_at" timestamp with time zone,
	"payment_ref" varchar(64),
	"validated_at" timestamp with time zone,
	"validated_by" integer,
	"decision_reason" text,
	"expires_at" timestamp with time zone NOT NULL,
	"verify_token" varchar(64) NOT NULL,
	"requested_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"club_id" integer NOT NULL,
	"recipient" "consent_recipient" NOT NULL,
	"recipient_name" varchar(160) NOT NULL,
	"recipient_phone" varchar(32),
	"recipient_email" varchar(255),
	"token_hash" varchar(64) NOT NULL,
	"status" "consent_status" DEFAULT 'PENDING' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"link_expires_at" timestamp with time zone NOT NULL,
	"requested_by" integer,
	"responded_at" timestamp with time zone,
	"refusal_reason" text,
	"valid_until" timestamp with time zone,
	"declarations" jsonb,
	"respondent_ip" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"federal_id" varchar(24) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"first_name" varchar(80) NOT NULL,
	"birth_date" date NOT NULL,
	"birth_place" varchar(120),
	"gender" "gender" NOT NULL,
	"nationality" varchar(60) DEFAULT 'Congolaise' NOT NULL,
	"position" "player_position",
	"phone" varchar(32),
	"email" varchar(255),
	"guardian_name" varchar(160),
	"guardian_phone" varchar(32),
	"guardian_email" varchar(255),
	"club_id" integer,
	"identity_key" varchar(200) NOT NULL,
	"photo_key" varchar(200),
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_validated_by_users_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_consents" ADD CONSTRAINT "player_consents_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_consents" ADD CONSTRAINT "player_consents_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_consents" ADD CONSTRAINT "player_consents_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_number_uq" ON "licenses" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_verify_token_uq" ON "licenses" USING btree ("verify_token");--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_player_season_uq" ON "licenses" USING btree ("player_id","season") WHERE "licenses"."status" <> 'REJECTED';--> statement-breakpoint
CREATE INDEX "licenses_club_season_idx" ON "licenses" USING btree ("club_id","season");--> statement-breakpoint
CREATE INDEX "licenses_status_idx" ON "licenses" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "player_consents_token_uq" ON "player_consents" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "player_consents_player_club_idx" ON "player_consents" USING btree ("player_id","club_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_federal_id_uq" ON "players" USING btree ("federal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_identity_uq" ON "players" USING btree ("identity_key");--> statement-breakpoint
CREATE INDEX "players_club_idx" ON "players" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "players_name_idx" ON "players" USING btree ("last_name","first_name");