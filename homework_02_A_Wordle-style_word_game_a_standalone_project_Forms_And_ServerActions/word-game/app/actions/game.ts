"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { games, puzzles, scores } from "@/db/schema";
import { gameIdSchema, guessSchema, nicknameSchema } from "@/lib/validation";
import { checkGuess } from "@/lib/wordle";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
  message?: string;
};

export async function startGame(formData: FormData) {
  const id = Number(formData.get("puzzleId"));

  if (!Number.isSafeInteger(id) || id < 1) {
    redirect("/");
  }

  let gameId: string | undefined;

  try {
    const db = getDb();

    const [puzzle] = await db
      .select({ id: puzzles.id })
      .from(puzzles)
      .where(and(eq(puzzles.id, id), eq(puzzles.published, true)))
      .limit(1);

    if (!puzzle) {
      redirect("/");
    }

    const [game] = await db
      .insert(games)
      .values({ puzzleId: id })
      .returning({ id: games.id });

    gameId = game.id;
  } catch (error) {
    throw error;
  }

  if (!gameId) {
    redirect("/");
  }

  redirect(`/game/${gameId}`);
}

export async function submitGuess(
  gameId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = String(formData.get("guess") ?? "");
  const parsedId = gameIdSchema.safeParse(gameId);
  const parsedGuess = guessSchema.safeParse(raw);

  if (!parsedId.success)
    return { error: "Game not found.", values: { guess: raw } };

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
        .where(eq(games.id, parsedId.data))
        .for("update")
        .limit(1);

      if (!game) return { error: "Game not found." };

      if (game.status !== "playing" || game.guesses.length >= 6)
        return { error: "This game has already finished." };

      const [puzzle] = await tx
        .select()
        .from(puzzles)
        .where(eq(puzzles.id, game.puzzleId))
        .limit(1);

      if (!puzzle) return { error: "Puzzle not found." };

      const word = parsedGuess.data;
      const attempt = { word, results: checkGuess(puzzle.answer, word) };
      const guesses = [...game.guesses, attempt];
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
        guessesCount: guesses.length,
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
  formData: FormData,
): Promise<ActionState> {
  const raw = String(formData.get("nickname") ?? "");
  const id = gameIdSchema.safeParse(gameId);
  const nickname = nicknameSchema.safeParse(raw);

  if (!id.success)
    return { error: "Game not found.", values: { nickname: raw } };

  if (!nickname.success)
    return {
      fieldErrors: {
        nickname: nickname.error.issues.map((issue) => issue.message),
      },
      values: { nickname: raw },
    };
  try {
    const db = getDb();
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, id.data))
      .limit(1);

    if (!game) return { error: "Game not found." };

    if (game.status === "playing")
      return { error: "Finish the game before saving a score." };

    if (game.status !== "won")
      return { message: "Only winning games can be saved to the leaderboard." };

    const [existing] = await db
      .select({ id: scores.id })
      .from(scores)
      .where(eq(scores.gameId, game.id))
      .limit(1);

    if (existing)
      return { message: "This game's score has already been saved." };

    const inserted = await db
      .insert(scores)
      .values({
        gameId: game.id,
        puzzleId: game.puzzleId,
        nickname: nickname.data,
        attempts: game.guesses.length,
      })
      .onConflictDoNothing({ target: scores.gameId })
      .returning({ id: scores.id });

    if (inserted.length === 0)
      return { message: "This game's score has already been saved." };

    revalidatePath(`/puzzle/${game.puzzleId}`);
    revalidatePath("/hall-of-fame");
    return { message: "Your score was saved!" };
  } catch {
    return {
      error: "We couldn't save your score. Please try again.",
      values: { nickname: raw },
    };
  }
}
