import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { games, puzzles, scores } from "@/db/schema";

export async function getPuzzleNumbers() {
  return getDb()
    .select({ id: puzzles.id, difficulty: puzzles.difficulty })
    .from(puzzles)
    .where(eq(puzzles.published, true))
    .orderBy(asc(puzzles.id));
}

export async function getPublishedPuzzle(id: number) {
  const [puzzle] = await getDb()
    .select({
      id: puzzles.id,
      difficulty: puzzles.difficulty,
      hint: puzzles.hint,
    })
    .from(puzzles)
    .where(and(eq(puzzles.id, id), eq(puzzles.published, true)))
    .limit(1);
  return puzzle ?? null;
}

export async function getNextPuzzleId(id: number) {
  const [next] = await getDb()
    .select({ id: puzzles.id })
    .from(puzzles)
    .where(and(sql`${puzzles.id} > ${id}`, eq(puzzles.published, true)))
    .orderBy(asc(puzzles.id))
    .limit(1);
  return next?.id ?? null;
}

export async function getGame(id: string) {
  const [game] = await getDb()
    .select()
    .from(games)
    .where(eq(games.id, id))
    .limit(1);
  return game ?? null;
}

export async function getPuzzleLeaderboard(puzzleId: number) {
  return getDb()
    .select({
      nickname: scores.nickname,
      attempts: scores.attempts,
      createdAt: scores.createdAt,
    })
    .from(scores)
    .where(eq(scores.puzzleId, puzzleId))
    .orderBy(asc(scores.attempts), asc(scores.createdAt))
    .limit(10);
}

export async function getHallOfFame() {
  return getDb()
    .select({
      nickname: scores.nickname,
      wins: count(scores.id),
      lastWin: sql<Date>`max(${scores.createdAt})`,
    })
    .from(scores)
    .groupBy(scores.nickname)
    .orderBy(desc(count(scores.id)), asc(sql`min(${scores.createdAt})`))
    .limit(10);
}

export async function getAdminPuzzles() {
  return getDb()
    .select({
      id: puzzles.id,
      answer: puzzles.answer,
      difficulty: puzzles.difficulty,
      hint: puzzles.hint,
      published: puzzles.published,
      played: count(games.id),
      won: sql<number>`count(*) filter (where ${games.status} = 'won')`,
    })
    .from(puzzles)
    .leftJoin(games, eq(games.puzzleId, puzzles.id))
    .groupBy(puzzles.id)
    .orderBy(asc(puzzles.id));
}
