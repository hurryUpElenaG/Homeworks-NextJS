import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { LetterResult } from "@/lib/wordle";

export const puzzles = pgTable("puzzles", {
  id: integer("id").primaryKey(),
  answer: varchar("answer", { length: 5 }).notNull().unique(),
  difficulty: varchar("difficulty", { length: 10 }).notNull().default("medium"),
  hint: varchar("hint", { length: 140 }),
  published: integer("published").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Puzzle = typeof puzzles.$inferSelect;

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  puzzleId: integer("puzzle_id")
    .notNull()
    .references(() => puzzles.id),
  status: varchar("status", { length: 10 }).notNull().default("playing"),
  guesses: jsonb("guesses")
    .$type<{ word: string; results: LetterResult[] }[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id),
    puzzleId: integer("puzzle_id")
      .notNull()
      .references(() => puzzles.id),
    nickname: varchar("nickname", { length: 20 }).notNull(),
    attempts: integer("attempts").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("scores_game_id_unique").on(table.gameId)],
);

export const PuzzleDifficulty = ["easy", "medium", "hard"] as const;
export type PuzzleDifficulty = (typeof PuzzleDifficulty)[number];
