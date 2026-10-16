CREATE TYPE "public"."club_status" AS ENUM('PENDING', 'AFFILIATED', 'SUSPENDED', 'STRUCK_OFF');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('SUPER_ADMIN', 'FEDERATION_ADMIN', 'LEAGUE', 'CLUB', 'DTN', 'COMMUNICATION', 'TICKETING', 'REFEREEING');--> statement-breakpoint
CREATE SEQUENCE "public"."club_affiliation_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" varchar(64) NOT NULL,
	"entity" varchar(64) NOT NULL,
	"entity_id" varchar(64),
	"details" jsonb,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_officials" (
	"id" serial PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"position" varchar(80) NOT NULL,
	"email" varchar(255),
	"phone" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliation_number" varchar(16) NOT NULL,
	"name" varchar(160) NOT NULL,
	"short_name" varchar(16),
	"slug" varchar(180) NOT NULL,
	"league_id" integer NOT NULL,
	"city" varchar(120) NOT NULL,
	"stadium" varchar(160),
	"colors" varchar(80),
	"founded_year" integer,
	"status" "club_status" DEFAULT 'PENDING' NOT NULL,
	"email" varchar(255),
	"phone" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(8) NOT NULL,
	"name" varchar(120) NOT NULL,
	"president" varchar(160),
	"email" varchar(255),
	"phone" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"phone" varchar(32),
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"league_id" integer,
	"club_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_officials" ADD CONSTRAINT "club_officials_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "club_officials_club_idx" ON "club_officials" USING btree ("club_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clubs_affiliation_uq" ON "clubs" USING btree ("affiliation_number");--> statement-breakpoint
CREATE UNIQUE INDEX "clubs_slug_uq" ON "clubs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "clubs_league_idx" ON "clubs" USING btree ("league_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leagues_code_uq" ON "leagues" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");