CREATE TYPE "public"."ticket_event_kind" AS ENUM('NATIONAL_TEAM', 'LEAGUE', 'CUP', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."order_channel" AS ENUM('ONLINE', 'COUNTER', 'INVITATION');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."sales_status" AS ENUM('DRAFT', 'PRESALE', 'OPEN', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('RESERVED', 'VALID', 'USED', 'CANCELLED');--> statement-breakpoint
CREATE SEQUENCE "public"."ticket_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "scan_refusals" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"reason" varchar(24) NOT NULL,
	"ticket_id" integer,
	"gate" varchar(40),
	"scanned_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"name" varchar(80) NOT NULL,
	"gate" varchar(40) NOT NULL,
	"capacity" integer NOT NULL,
	"public_price" integer NOT NULL,
	"member_price" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(180) NOT NULL,
	"title" varchar(200) NOT NULL,
	"kind" "ticket_event_kind" NOT NULL,
	"venue" varchar(160) NOT NULL,
	"kickoff_at" timestamp with time zone NOT NULL,
	"sales_status" "sales_status" DEFAULT 'DRAFT' NOT NULL,
	"max_tickets_per_fan" integer DEFAULT 4 NOT NULL,
	"attendance_points" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" varchar(24) NOT NULL,
	"event_id" integer NOT NULL,
	"supporter_id" integer NOT NULL,
	"channel" "order_channel" NOT NULL,
	"status" "order_status" DEFAULT 'PENDING' NOT NULL,
	"total" integer NOT NULL,
	"expires_at" timestamp with time zone,
	"sold_by" integer,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"refunded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(16) NOT NULL,
	"order_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"holder_name" varchar(160) NOT NULL,
	"holder_supporter_id" integer,
	"price" integer NOT NULL,
	"token" varchar(64) NOT NULL,
	"status" "ticket_status" DEFAULT 'RESERVED' NOT NULL,
	"used_at" timestamp with time zone,
	"used_gate" varchar(40),
	"scanned_by" integer
);
--> statement-breakpoint
ALTER TABLE "scan_refusals" ADD CONSTRAINT "scan_refusals_event_id_ticket_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."ticket_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_refusals" ADD CONSTRAINT "scan_refusals_scanned_by_users_id_fk" FOREIGN KEY ("scanned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_event_id_ticket_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."ticket_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_orders" ADD CONSTRAINT "ticket_orders_event_id_ticket_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."ticket_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_orders" ADD CONSTRAINT "ticket_orders_supporter_id_supporters_id_fk" FOREIGN KEY ("supporter_id") REFERENCES "public"."supporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_orders" ADD CONSTRAINT "ticket_orders_sold_by_users_id_fk" FOREIGN KEY ("sold_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_orders" ADD CONSTRAINT "ticket_orders_refunded_by_users_id_fk" FOREIGN KEY ("refunded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_ticket_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."ticket_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_ticket_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ticket_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_holder_supporter_id_supporters_id_fk" FOREIGN KEY ("holder_supporter_id") REFERENCES "public"."supporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_scanned_by_users_id_fk" FOREIGN KEY ("scanned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_refusals_event_idx" ON "scan_refusals" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_categories_event_idx" ON "ticket_categories" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_events_slug_uq" ON "ticket_events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ticket_events_kickoff_idx" ON "ticket_events" USING btree ("kickoff_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_orders_reference_uq" ON "ticket_orders" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "ticket_orders_event_idx" ON "ticket_orders" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "ticket_orders_supporter_idx" ON "ticket_orders" USING btree ("supporter_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_number_uq" ON "tickets" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_token_uq" ON "tickets" USING btree ("token");--> statement-breakpoint
CREATE INDEX "tickets_category_status_idx" ON "tickets" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "tickets_event_status_idx" ON "tickets" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "tickets_order_idx" ON "tickets" USING btree ("order_id");