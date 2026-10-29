import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { games, puzzles, scores } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { requireAdmin, requireUser } from "@/lib/session";

export async function getPuzzleNumbers() {
  return getDb()
    .select({ id: puzzles.id, difficulty: puzzles.difficulty })
    .from(puzzles)
    .where(eq(puzzles.published, 1))
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
    .where(and(eq(puzzles.id, id), eq(puzzles.published, 1)))
    .limit(1);
  return puzzle ?? null;
}

export async function getNextPuzzleId(id: number) {
  const [next] = await getDb()
    .select({ id: puzzles.id })
    .from(puzzles)
    .where(and(sql`${puzzles.id} > ${id}`, eq(puzzles.published, 1)))
    .orderBy(asc(puzzles.id))
    .limit(1);
  return next?.id ?? null;
}

export async function getPuzzleLeaderboard(puzzleId: number) {
  return getDb()
    .select({
      nickname: user.name,
      attempts: scores.attempts,
      createdAt: scores.createdAt,
    })
    .from(scores)
    .innerJoin(user, eq(scores.ownerId, user.id))
    .where(eq(scores.puzzleId, puzzleId))
    .orderBy(asc(scores.attempts), asc(scores.createdAt))
    .limit(10);
}

export async function getHallOfFame() {
  return getDb()
    .select({ nickname: user.name, wins: count(scores.id) })
    .from(scores)
    .innerJoin(user, eq(scores.ownerId, user.id))
    .groupBy(user.id, user.name)
    .orderBy(desc(count(scores.id)), asc(sql`min(${scores.createdAt})`))
    .limit(10);
}

export async function getAdminPuzzles() {
  await requireAdmin("/admin");
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

export async function getMyGames() {
  const current = await requireUser("/my-games");
  return getDb()
    .select({
      id: games.id,
      puzzleId: games.puzzleId,
      status: games.status,
      attempts: sql<number>`jsonb_array_length(${games.guesses})`,
      createdAt: games.createdAt,
    })
    .from(games)
    .where(eq(games.ownerId, current.id))
    .orderBy(desc(games.createdAt));
}

export async function getMyGameStats() {
  const current = await requireUser("/my-games");
  const [stats] = await getDb()
    .select({
      played: count(games.id),
      won: sql<number>`count(*) filter (where ${games.status} = 'won')`,
    })
    .from(games)
    .where(eq(games.ownerId, current.id));
  return stats ?? { played: 0, won: 0 };
}

export async function getUsers() {
  await requireAdmin("/users");
  return getDb()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.email));
}
