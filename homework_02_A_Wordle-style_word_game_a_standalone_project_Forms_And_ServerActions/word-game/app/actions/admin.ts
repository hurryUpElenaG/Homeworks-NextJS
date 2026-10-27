
"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { puzzles } from "@/db/schema";
import {
  difficultySchema,
  hintSchema,
  puzzleWordSchema,
} from "@/lib/validation";
import type { ActionState } from "@/app/actions/game";

export async function addPuzzle(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    word: String(formData.get("word") ?? ""),
    difficulty: String(formData.get("difficulty") ?? ""),
    hint: String(formData.get("hint") ?? ""),
  };

  const word = puzzleWordSchema.safeParse(raw.word);
  const difficulty = difficultySchema.safeParse(raw.difficulty);
  const hint = hintSchema.safeParse(raw.hint);

  const fieldErrors: Record<string, string[]> = {};

  if (!word.success) {
    fieldErrors.word = [
      word.error.issues[0]?.message ?? "Invalid word.",
    ];
  }

  if (!difficulty.success) {
    fieldErrors.difficulty = [
      "Choose easy, medium, or hard.",
    ];
  }

  if (!hint.success) {
    fieldErrors.hint = [
      hint.error.issues[0]?.message ?? "Invalid hint.",
    ];
  }

  // Return validation errors before accessing parsed data.
  if (!word.success || !difficulty.success || !hint.success) {
    return { fieldErrors, values: raw };
  }

  const db = getDb();

  try {
    // Prevent adding a word that already exists.
    const [existing] = await db
      .select({ id: puzzles.id })
      .from(puzzles)
      .where(eq(puzzles.answer, word.data))
      .limit(1);

    if (existing) {
      return {
        fieldErrors: {
          word: ["That word already exists."],
        },
        values: raw,
      };
    }

    // The current schema requires an explicit integer ID.
    const [next] = await db
      .select({
        id: sql<number>`coalesce(max(${puzzles.id}), 0) + 1`,
      })
      .from(puzzles);

    await db.insert(puzzles).values({
      id: next.id,
      answer: word.data,
      difficulty: difficulty.data,
      hint: hint.data || null,
      published: formData.get("published") === "on" ? 1 : 0,
    });
  } catch (error: unknown) {
    if (isPostgresUniqueViolation(error)) {
      return {
        fieldErrors: {
          word: ["That word already exists."],
        },
        values: raw,
      };
    }

    console.error("Failed to add puzzle:", error);

    return {
      error: "We couldn't add the puzzle. Please try again.",
      values: raw,
    };
  }

  revalidatePath("/");
  revalidatePath("/admin");

  redirect("/admin");
}

export async function togglePublished(
  formData: FormData,
): Promise<void> {
  const id = Number(formData.get("puzzleId"));

  if (!Number.isSafeInteger(id) || id < 1) {
    redirect("/admin");
  }

  const db = getDb();

  await db
    .update(puzzles)
    .set({
      published: sql`
        case
          when ${puzzles.published} = 1 then 0
          else 1
        end
      `,
    })
    .where(eq(puzzles.id, id));

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/puzzle/${id}`);

  redirect("/admin");
}

function isPostgresUniqueViolation(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
