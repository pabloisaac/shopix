CREATE TYPE "public"."order_message_type" AS ENUM('buyer_asking_shipping_date', 'buyer_asking_status', 'buyer_asking_delay', 'buyer_received_damaged', 'seller_shipped', 'seller_shipping_delayed', 'seller_problem_stock', 'seller_pickup_ready', 'seller_shipped_late_warning');--> statement-breakpoint
ALTER TYPE "public"."order_event_type" ADD VALUE 'shipping_deadline_warning';--> statement-breakpoint
ALTER TYPE "public"."order_event_type" ADD VALUE 'auto_cancelled';--> statement-breakpoint
CREATE TABLE "order_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"message_type" "order_message_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_deadline_at" timestamp;--> statement-breakpoint
ALTER TABLE "order_messages" ADD CONSTRAINT "order_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_messages" ADD CONSTRAINT "order_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_messages_order_id_idx" ON "order_messages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_messages_sender_id_idx" ON "order_messages" USING btree ("sender_id");