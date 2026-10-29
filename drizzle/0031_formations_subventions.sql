CREATE TYPE "public"."expense_status" AS ENUM('SUBMITTED', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."grant_status" AS ENUM('DRAFT', 'SIGNED', 'PAID', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('REGISTERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."training_role" AS ENUM('CLUB_PRESIDENT', 'CLUB_SECRETARY', 'LEAGUE_PRESIDENT', 'OTHER');--> statement-breakpoint
CREATE SEQUENCE "public"."grant_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "club_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(16) NOT NULL,
	"club_id" integer NOT NULL,
	"training_id" integer,
	"programme" varchar(160) NOT NULL,
	"amount" integer NOT NULL,
	"status" "grant_status" DEFAULT 'DRAFT' NOT NULL,
	"convention_key" varchar(255),
	"signed_convention_key" varchar(255),
	"signed_at" timestamp with time zone,
	"paid_at" date,
	"payment_ref" varchar(80),
	"closed_at" timestamp with time zone,
	"note" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grant_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"grant_id" integer NOT NULL,
	"label" varchar(200) NOT NULL,
	"amount" integer NOT NULL,
	"spent_on" date NOT NULL,
	"document_key" varchar(255) NOT NULL,
	"document_type" varchar(64) NOT NULL,
	"status" "expense_status" DEFAULT 'SUBMITTED' NOT NULL,
	"review_note" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone,
	"submitted_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"training_id" integer NOT NULL,
	"club_id" integer,
	"league_id" integer,
	"full_name" varchar(160) NOT NULL,
	"role" "training_role" NOT NULL,
	"phone" varchar(32),
	"email" varchar(255),
	"status" "registration_status" DEFAULT 'REGISTERED' NOT NULL,
	"present_days" date[] DEFAULT '{}'::date[] NOT NULL,
	"registered_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainings" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title" varchar(200) NOT NULL,
	"organizer" varchar(120) NOT NULL,
	"description" text,
	"location" varchar(160) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"capacity" integer,
	"modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"registration_open" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "club_grants" ADD CONSTRAINT "club_grants_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_grants" ADD CONSTRAINT "club_grants_training_id_trainings_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."trainings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_grants" ADD CONSTRAINT "club_grants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grant_expenses" ADD CONSTRAINT "grant_expenses_grant_id_club_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."club_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grant_expenses" ADD CONSTRAINT "grant_expenses_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grant_expenses" ADD CONSTRAINT "grant_expenses_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_registrations" ADD CONSTRAINT "training_registrations_training_id_trainings_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."trainings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_registrations" ADD CONSTRAINT "training_registrations_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_registrations" ADD CONSTRAINT "training_registrations_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_registrations" ADD CONSTRAINT "training_registrations_registered_by_users_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "club_grants_number_uq" ON "club_grants" USING btree ("number");--> statement-breakpoint
CREATE INDEX "club_grants_club_idx" ON "club_grants" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "grant_expenses_grant_idx" ON "grant_expenses" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "training_registrations_training_idx" ON "training_registrations" USING btree ("training_id","status");--> statement-breakpoint
CREATE INDEX "training_registrations_club_idx" ON "training_registrations" USING btree ("club_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trainings_slug_uq" ON "trainings" USING btree ("slug");