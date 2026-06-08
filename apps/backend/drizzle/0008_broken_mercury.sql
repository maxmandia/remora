CREATE TABLE "generation_thread" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_job" ADD COLUMN "thread_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_thread" ADD CONSTRAINT "generation_thread_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_thread_user_id_idx" ON "generation_thread" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generation_thread_user_id_updated_at_idx" ON "generation_thread" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_thread_id_user_id_idx" ON "generation_thread" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "generation_job" ADD CONSTRAINT "generation_job_thread_user_fk" FOREIGN KEY ("thread_id","user_id") REFERENCES "public"."generation_thread"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_job_thread_id_idx" ON "generation_job" USING btree ("thread_id");