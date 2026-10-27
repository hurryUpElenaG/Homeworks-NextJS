ALTER TABLE "puzzles"
ADD COLUMN "difficulty" varchar(10) NOT NULL DEFAULT 'medium';
ALTER TABLE "puzzles"
ADD COLUMN "hint" varchar(140);
ALTER TABLE "puzzles"
ADD COLUMN "published" integer NOT NULL DEFAULT 1;
ALTER TABLE "puzzles"
ADD COLUMN "created_at" timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE "puzzles"
ADD CONSTRAINT "puzzles_answer_unique" UNIQUE ("answer");
CREATE TABLE "games" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "puzzle_id" integer NOT NULL REFERENCES "puzzles"("id"),
    "status" varchar(10) NOT NULL DEFAULT 'playing',
    "guesses" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "finished_at" timestamp with time zone
);
CREATE TABLE "scores" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "game_id" uuid NOT NULL REFERENCES "games"("id"),
    "puzzle_id" integer NOT NULL REFERENCES "puzzles"("id"),
    "nickname" varchar(20) NOT NULL,
    "attempts" integer NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "scores_game_id_unique" ON "scores" ("game_id");