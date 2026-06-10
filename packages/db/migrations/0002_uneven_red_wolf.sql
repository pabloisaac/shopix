CREATE TYPE "public"."user_risk_level" AS ENUM('clean', 'warning', 'risky', 'banned');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "disputes_lost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "disputes_won" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "risk_level" "user_risk_level" DEFAULT 'clean' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_reason" text;