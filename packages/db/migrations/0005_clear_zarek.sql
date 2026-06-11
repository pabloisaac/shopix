ALTER TYPE "public"."order_status" ADD VALUE 'awaiting_payment' BEFORE 'pending_payment';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_encrypted_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "seller_payout_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "buyer_refund_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "buyer_email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "confirmation_token" text;