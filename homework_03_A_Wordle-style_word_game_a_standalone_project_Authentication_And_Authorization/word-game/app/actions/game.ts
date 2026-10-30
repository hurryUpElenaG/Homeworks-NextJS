"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { games, puzzles, scores } from "@/db/schema";
import { gameIdSchema, guessSchema } from "@/lib/validation";
import { checkGuess } from "@/lib/wordle";
import { requireUser } from "@/lib/session";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
  message?: string;
};

export async function startGame(formData: FormData) {
  const id = Number(formData.get("puzzleId"));

  if (!Number.isSafeInteger(id) || id < 1) redirect("/");

  const { getCurrentUser } = await import("@/lib/session");
  const user = await getCurrentUser();

  if (!user)
    redirect(`/sign-in?next=${encodeURIComponent(`/play?puzzleId=${id}`)}`);

  const db = getDb();
  const [puzzle] = await db
    .select({ id: puzzles.id })
    .from(puzzles)
    .where(and(eq(puzzles.id, id), eq(puzzles.published, 1)))
    .limit(1);
  
  if (!puzzle) redirect("/");

  const [game] = await db
    .insert(games)
    .values({ puzzleId: id, ownerId: user.id })
    .returning({ id: games.id });
  redirect(`/game/${game.id}`);
}

export async function submitGuess(
  gameId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {

  const user = await requireUser(`/game/${gameId}`);
  const raw = String(formData.get("guess") ?? "");
  const parsedId = gameIdSchema.safeParse(gameId);
  const parsedGuess = guessSchema.safeParse(raw);

  if (!parsedId.success) return { error: "Game not found." };

  if (!parsedGuess.success)
    return {
      fieldErrors: { guess: ["Enter exactly five letters (A–Z)."] },
      values: { guess: raw },
    };

  try {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [game] = await tx
        .select()
        .from(games)
        .where(and(eq(games.id, parsedId.data), eq(games.ownerId, user.id)))
        .for("update")
        .limit(1);

      if (!game) return { error: "Game not found." as const };

      if (game.status !== "playing" || game.guesses.length >= 6)
        return { error: "This game has already finished." as const };

      const [puzzle] = await tx
        .select()
        .from(puzzles)
        .where(eq(puzzles.id, game.puzzleId))
        .limit(1);

      if (!puzzle) return { error: "Game not found." as const };

      const word = parsedGuess.data;
      const guesses = [
        ...game.guesses,
        { word, results: checkGuess(puzzle.answer, word) },
      ];
      const won = word === puzzle.answer;
      const status = won ? "won" : guesses.length === 6 ? "lost" : "playing";

      await tx
        .update(games)
        .set({
          guesses,
          status,
          ...(status !== "playing" ? { finishedAt: new Date() } : {}),
        })
        .where(eq(games.id, game.id));

      return {
        status,
        won,
        answer: status === "lost" ? puzzle.answer : undefined,
      };
    });

    if ("error" in result) return { error: result.error };

    revalidatePath(`/game/${gameId}`);

    return {
      message:
        result.status === "playing"
          ? "Guess saved."
          : result.won
            ? "You won!"
            : `Game over. The answer was ${result.answer?.toUpperCase()}.`,
    };
  } catch {
    return {
      error: "We couldn't save your guess. Please try again.",
      values: { guess: raw },
    };
  }
}

export async function saveScore(
  gameId: string,
  _previous: ActionState,
  _formData: FormData,
): Promise<ActionState> {

  const user = await requireUser(`/game/${gameId}`);
  const id = gameIdSchema.safeParse(gameId);

  if (!id.success) return { error: "Game not found." };

  try {
    const db = getDb();
    const [game] = await db
      .select()
      .from(games)
      .where(and(eq(games.id, id.data), eq(games.ownerId, user.id)))
      .limit(1);

    if (!game) return { error: "Game not found." };

    if (game.status === "playing")
      return { error: "Finish the game before saving a score." };

    if (game.status !== "won")
      return { message: "Only winning games can be saved to the leaderboard." };

    const inserted = await db
      .insert(scores)
      .values({
        gameId: game.id,
        ownerId: user.id,
        puzzleId: game.puzzleId,
        nickname: user.name.slice(0, 20),
        attempts: game.guesses.length,
      })
      .onConflictDoNothing({ target: scores.gameId })
      .returning({ id: scores.id });

    if (!inserted.length)
      return { message: "This game's score has already been saved." };

    revalidatePath(`/puzzle/${game.puzzleId}`);
    revalidatePath("/hall-of-fame");
    revalidatePath("/my-games");

    return { message: "Your score was saved!" };
    
  } catch {
    return { error: "We couldn't save your score. Please try again." };
  }
}
