import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const puzzles = pgTable("puzzles", {
  id: integer("id").primaryKey(),
  answer: varchar("answer", { length: 5 }).notNull(),
});

export type Puzzle = typeof puzzles.$inferSelect;
