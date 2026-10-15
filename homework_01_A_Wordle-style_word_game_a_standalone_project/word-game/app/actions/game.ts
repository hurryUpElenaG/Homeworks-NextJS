"use server";

import { getPuzzleById } from "@/db/queries";
import { attemptNumberSchema, guessSchema } from "@/lib/validation";
import { checkGuess, type LetterResult } from "@/lib/wordle";

export type GuessResponse = {
  results: LetterResult[];
  won: boolean;
  gameOver: boolean;
  answer?: string;
  error?: string;
};

export async function submitGuess(
  puzzleId: number,
  rawGuess: string,
  attemptNumber: number,
): Promise<GuessResponse> {
  const validAttempt = attemptNumberSchema.safeParse(attemptNumber);
  if (!validAttempt.success) {
    return { results: [], won: false, gameOver: false, error: "Invalid attempt number." };
  }

  if (!Number.isSafeInteger(puzzleId) || puzzleId < 1 || puzzleId > 999) {
    return { results: [], won: false, gameOver: false, error: "Puzzle not found." };
  }

  const parsedGuess = guessSchema.safeParse(rawGuess);
  if (!parsedGuess.success) {
    return { results: [], won: false, gameOver: false, error: "Enter exactly five letters (A–Z)." };
  }

  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) {
    return { results: [], won: false, gameOver: false, error: "Puzzle not found." };
  }

  const guess = parsedGuess.data;
  const results = checkGuess(puzzle.answer, guess);
  const won = guess === puzzle.answer;
  const gameOver = won || validAttempt.data === 6;

  return {
    results,
    won,
    gameOver,
    ...(gameOver ? { answer: puzzle.answer } : {}),
  };
}
