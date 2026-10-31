ALTER TABLE "accreditations" ALTER COLUMN "press_card_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accreditations" ADD COLUMN "proof_kind" varchar(16);--> statement-breakpoint
ALTER TABLE "accreditations" ADD COLUMN "proof_key" varchar(255);--> statement-breakpoint
ALTER TABLE "accreditations" ADD COLUMN "proof_type" varchar(64);