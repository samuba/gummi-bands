CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"weight_unit" text DEFAULT 'lbs' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
