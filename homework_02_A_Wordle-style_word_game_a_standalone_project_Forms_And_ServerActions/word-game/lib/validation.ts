import { z } from "zod";

// Accept numeric route segments from 1 to 999. The database decides if one exists.
export const puzzleIdSchema = z
  .string()
  .regex(/^[1-9]\d{0,2}$/, "Invalid puzzle number.")
  .transform(Number)
  .pipe(z.number().int().min(1).max(999));

export const guessSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]{5}$/, "Enter exactly five letters (A–Z).")
  .transform((guess) => guess.toLowerCase());

export const attemptNumberSchema = z.number().int().min(1).max(6);
