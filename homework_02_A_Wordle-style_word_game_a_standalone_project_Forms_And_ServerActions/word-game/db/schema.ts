import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { LetterResult } from "@/lib/wordle";

export const puzzleDifficultyEnum = pgEnum("puzzle_difficulty", [
  "easy",
  "medium",
  "hard",
]);

export const gameStatusEnum = pgEnum("game_status", ["playing", "won", "lost"]);

export const puzzles = pgTable("puzzles", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  answer: varchar("answer", { length: 5 }).notNull().unique(),
  difficulty: puzzleDifficultyEnum("difficulty").notNull().default("medium"),
  hint: varchar("hint", { length: 140 }),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

export type Puzzle = typeof puzzles.$inferSelect;

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  puzzleId: integer("puzzle_id")
    .notNull()
    .references(() => puzzles.id),
  status: gameStatusEnum("status").notNull().default("playing"),
  guesses: jsonb("guesses")
    .$type<{ word: string; results: LetterResult[] }[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", {
    withTimezone: true,
  }),
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
    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("scores_game_id_unique").on(table.gameId)],
);

export type PuzzleDifficulty = (typeof puzzleDifficultyEnum.enumValues)[number];
export type GameStatus = (typeof gameStatusEnum.enumValues)[number];
