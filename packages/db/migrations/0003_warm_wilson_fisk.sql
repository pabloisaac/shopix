CREATE TYPE "public"."return_carrier" AS ENUM('andreani', 'oca', 'correo_argentino', 'pickup');--> statement-breakpoint
ALTER TYPE "public"."order_event_type" ADD VALUE 'return_required' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."order_event_type" ADD VALUE 'return_tracking_uploaded' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."order_event_type" ADD VALUE 'return_received' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."order_event_type" ADD VALUE 'return_deadline_missed' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'return_required' BEFORE 'refunded';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'return_in_transit' BEFORE 'refunded';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'refunded_no_return';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "return_deadline_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "return_tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "return_carrier" "return_carrier";