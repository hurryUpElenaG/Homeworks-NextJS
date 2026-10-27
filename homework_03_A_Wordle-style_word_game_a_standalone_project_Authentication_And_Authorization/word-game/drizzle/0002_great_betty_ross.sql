CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"puzzle_id" integer NOT NULL,
	"status" varchar(10) DEFAULT 'playing' NOT NULL,
	"guesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"puzzle_id" integer NOT NULL,
	"nickname" varchar(20) NOT NULL,
	"attempts" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "puzzles" ADD COLUMN "difficulty" varchar(10) DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "puzzles" ADD COLUMN "hint" varchar(140);--> statement-breakpoint
ALTER TABLE "puzzles" ADD COLUMN "published" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "puzzles" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_puzzle_id_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."puzzles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_puzzle_id_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."puzzles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scores_game_id_unique" ON "scores" USING btree ("game_id");--> statement-breakpoint
ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_answer_unique" UNIQUE("answer");