CREATE TYPE "public"."document_owner" AS ENUM('player', 'club');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('PLAYER_PHOTO', 'BIRTH_CERTIFICATE', 'MEDICAL_CERTIFICATE', 'ID_DOCUMENT', 'CLUB_LOGO', 'CLUB_STATUTES', 'CLUB_AGM_MINUTES');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_type" "document_owner" NOT NULL,
	"owner_id" integer NOT NULL,
	"type" "document_type" NOT NULL,
	"storage_key" varchar(200) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"content_type" varchar(64) NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_storage_key_uq" ON "documents" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "documents" USING btree ("owner_type","owner_id","type");--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "photo_key";