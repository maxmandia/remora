CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_thread" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_user_id_idx" ON "project" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_user_id_archived_at_updated_at_idx" ON "project" USING btree ("user_id","archived_at","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_id_user_id_idx" ON "project" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_user_id_lower_name_idx" ON "project" USING btree ("user_id",lower("name"));--> statement-breakpoint
ALTER TABLE "generation_thread" ADD CONSTRAINT "generation_thread_project_user_fk" FOREIGN KEY ("project_id","user_id") REFERENCES "public"."project"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_thread_user_id_project_id_updated_at_idx" ON "generation_thread" USING btree ("user_id","project_id","updated_at");