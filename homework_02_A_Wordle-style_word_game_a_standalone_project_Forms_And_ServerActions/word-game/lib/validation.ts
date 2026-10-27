import { z } from "zod";
export const puzzleIdSchema = z
  .string()
  .regex(/^[1-9]\d{0,2}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(999));

export const guessSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]{5}$/, "Enter exactly five letters (A–Z).")
  .transform((v) => v.toLowerCase());

export const nicknameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(20, "Use no more than 20 characters.")
  .regex(
    /^[a-zA-Z0-9 _-]+$/,
    "Use only letters, numbers, spaces, hyphens, and underscores.",
  );

export const puzzleWordSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]{5}$/, "Enter exactly five letters (A–Z).")
  .transform((v) => v.toLowerCase());

export const difficultySchema = z.enum(["easy", "medium", "hard"]);

export const hintSchema = z
  .string()
  .trim()
  .max(140, "Hint must be 140 characters or fewer.");

export const gameIdSchema = z.string().uuid();
