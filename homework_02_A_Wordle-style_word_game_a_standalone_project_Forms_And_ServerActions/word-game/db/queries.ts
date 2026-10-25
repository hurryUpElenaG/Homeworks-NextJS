import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { puzzles } from "@/db/schema";

/** Return puzzle numbers only, so the home page never receives secret answers. */
export async function getPuzzleNumbers() {
  return getDb().select({ id: puzzles.id }).from(puzzles).orderBy(asc(puzzles.id));
}

/** Retrieve one puzzle for server-side use. Do not pass the answer to client components. */
export async function getPuzzleById(id: number) {
  const [puzzle] = await getDb().select().from(puzzles).where(eq(puzzles.id, id)).limit(1);
  return puzzle ?? null;
}

/** Return the next numbered puzzle only if it actually exists. */
export async function getNextPuzzleId(id: number) {
  const [next] = await getDb()
    .select({ id: puzzles.id })
    .from(puzzles)
    .where(eq(puzzles.id, id + 1))
    .limit(1);
  return next?.id ?? null;
}
