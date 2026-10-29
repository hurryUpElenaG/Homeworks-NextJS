import { and, eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { getDb } from "@/db";
import { games, puzzles } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { puzzleIdSchema } from "@/lib/validation";

export default async function PlayPage({searchParams}: {searchParams: Promise<{ puzzleId?: string }>}) {

  const params = await searchParams;
  const parsed = puzzleIdSchema.safeParse(params.puzzleId ?? "");

  if (!parsed.success) notFound();

  const user = await requireUser(`/play?puzzleId=${parsed.data}`);

  const db = getDb();
  const [puzzle] = await db
    .select({ id: puzzles.id })
    .from(puzzles)
    .where(and(eq(puzzles.id, parsed.data), eq(puzzles.published, 1)))
    .limit(1);

  if (!puzzle) notFound();

  const [game] = await db
    .insert(games)
    .values({ puzzleId: puzzle.id, ownerId: user.id })
    .returning({ id: games.id });
    
  redirect(`/game/${game.id}`);
}
