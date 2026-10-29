# Homework 3 — Word Game: all code files, file by file

## `db/auth-schema.ts`

```typescript
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("player"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

## `db/auth.ts`

```typescript
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import * as schema from "@/db/auth-schema";

const github = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET } }
  : undefined;

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
  socialProviders: github,
  user: { additionalFields: { role: { type: "string", required: false, defaultValue: "player", input: false } } },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  plugins: [nextCookies()],
});
export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
```

## `db/index.ts`

```typescript
import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as gameSchema from "./schema";
import * as authSchema from "./auth-schema";

const globalForPool = globalThis as unknown as { wordGamePool?: Pool };
function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured. Add it to .env.");
  globalForPool.wordGamePool ??= new Pool({ connectionString });
  return globalForPool.wordGamePool;
}
export function getDb() {
  return drizzle({ client: getPool(), schema: { ...gameSchema, ...authSchema }, casing: "snake_case" });
}
```

## `db/queries.ts`

```typescript
import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { games, puzzles, scores } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { requireAdmin, requireUser } from "@/lib/session";

export async function getPuzzleNumbers() {
  return getDb().select({ id: puzzles.id, difficulty: puzzles.difficulty }).from(puzzles)
    .where(eq(puzzles.published, 1)).orderBy(asc(puzzles.id));
}
export async function getPublishedPuzzle(id: number) {
  const [puzzle] = await getDb().select({ id: puzzles.id, difficulty: puzzles.difficulty, hint: puzzles.hint })
    .from(puzzles).where(and(eq(puzzles.id, id), eq(puzzles.published, 1))).limit(1);
  return puzzle ?? null;
}
export async function getNextPuzzleId(id: number) {
  const [next] = await getDb().select({ id: puzzles.id }).from(puzzles)
    .where(and(sql`${puzzles.id} > ${id}`, eq(puzzles.published, 1))).orderBy(asc(puzzles.id)).limit(1);
  return next?.id ?? null;
}
export async function getPuzzleLeaderboard(puzzleId: number) {
  return getDb().select({ nickname: user.name, attempts: scores.attempts, createdAt: scores.createdAt })
    .from(scores).innerJoin(user, eq(scores.ownerId, user.id))
    .where(eq(scores.puzzleId, puzzleId)).orderBy(asc(scores.attempts), asc(scores.createdAt)).limit(10);
}
export async function getHallOfFame() {
  return getDb().select({ nickname: user.name, wins: count(scores.id) }).from(scores)
    .innerJoin(user, eq(scores.ownerId, user.id)).groupBy(user.id, user.name)
    .orderBy(desc(count(scores.id)), asc(sql`min(${scores.createdAt})`)).limit(10);
}
export async function getAdminPuzzles() {
  await requireAdmin("/admin");
  return getDb().select({
    id: puzzles.id, answer: puzzles.answer, difficulty: puzzles.difficulty, hint: puzzles.hint,
    published: puzzles.published, played: count(games.id),
    won: sql<number>`count(*) filter (where ${games.status} = 'won')`,
  }).from(puzzles).leftJoin(games, eq(games.puzzleId, puzzles.id))
    .groupBy(puzzles.id).orderBy(asc(puzzles.id));
}
export async function getMyGames() {
  const current = await requireUser("/my-games");
  return getDb().select({
    id: games.id, puzzleId: games.puzzleId, status: games.status,
    attempts: sql<number>`jsonb_array_length(${games.guesses})`,
    createdAt: games.createdAt,
  }).from(games).where(eq(games.ownerId, current.id)).orderBy(desc(games.createdAt));
}
export async function getMyGameStats() {
  const current = await requireUser("/my-games");
  const [stats] = await getDb().select({
    played: count(games.id),
    won: sql<number>`count(*) filter (where ${games.status} = 'won')`,
  }).from(games).where(eq(games.ownerId, current.id));
  return stats ?? { played: 0, won: 0 };
}
export async function getUsers() {
  await requireAdmin("/users");
  return getDb().select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })
    .from(user).orderBy(asc(user.email));
}
```

## `db/schema.ts`

```typescript
import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
  text,
} from "drizzle-orm/pg-core";
import type { LetterResult } from "@/lib/wordle";
import { user } from "./auth-schema";

export const puzzles = pgTable("puzzles", {
  id: integer("id").primaryKey(),
  answer: varchar("answer", { length: 5 }).notNull().unique(),
  difficulty: varchar("difficulty", { length: 10 }).notNull().default("medium"),
  hint: varchar("hint", { length: 140 }),
  published: integer("published").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Puzzle = typeof puzzles.$inferSelect;

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  puzzleId: integer("puzzle_id")
    .notNull()
    .references(() => puzzles.id),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 10 }).notNull().default("playing"),
  guesses: jsonb("guesses")
    .$type<{ word: string; results: LetterResult[] }[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id),
    ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    puzzleId: integer("puzzle_id")
      .notNull()
      .references(() => puzzles.id),
    nickname: varchar("nickname", { length: 20 }).notNull(),
    attempts: integer("attempts").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("scores_game_id_unique").on(table.gameId)],
);

export const PuzzleDifficulty = ["easy", "medium", "hard"] as const;
export type PuzzleDifficulty = (typeof PuzzleDifficulty)[number];
```

## `db/seed.ts`

```typescript
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { puzzles } from "./schema";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not configured. Add it to .env first.");
}

const words = [
  "apple",
  "brave",
  "crane",
  "drift",
  "eagle",
  "flame",
  "grape",
  "house",
  "input",
  "jelly",
  "knife",
  "lemon",
  "magic",
  "night",
  "ocean",
  "piano",
  "queen",
  "river",
  "stone",
  "tiger",
  "uncle",
  "video",
  "water",
  "young",
  "zebra",
  "bread",
  "chair",
  "dream",
  "earth",
  "field",
] as const;

async function seed() {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool });
  try {
    await db
      .insert(puzzles)
      .values(words.map((answer, index) => ({ id: index + 1, answer })))
      .onConflictDoNothing({ target: puzzles.id });
    process.stdout.write(
      `Seed complete: checked ${words.length} puzzle records.\n`,
    );
  } finally {
    await pool.end();
  }
}

seed().catch((error: unknown) => {
  process.stderr.write(`Puzzle seeding failed: ${String(error)}\n`);
  process.exitCode = 1;
});
```

## `lib/auth-client.ts`

```typescript
"use client";
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient();
export const { signIn, signUp, signOut, useSession } = authClient;
```

## `lib/safe-next.ts`

```typescript
export function safeNext(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\") || /[\r\n]/.test(candidate)) return "/";
  try {
    const parsed = new URL(candidate, "https://word-game.local");
    if (parsed.origin !== "https://word-game.local") return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}
```

## `lib/session.ts`

```typescript
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/db/auth";

export async function getCurrentUser() {
  const result = await auth.api.getSession({ headers: await headers() });
  return result?.user ?? null;
}
export async function requireUser(returnTo = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}
export async function requireAdmin(returnTo = "/admin") {
  const user = await requireUser(returnTo);
  if (user.role !== "admin") redirect("/not-allowed");
  return user;
}
export async function requirePlayer(returnTo: string) {
  return requireUser(returnTo);
}
```

## `lib/utils.ts`

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## `lib/validation.ts`

```typescript
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
```

## `lib/wordle.ts`

```typescript
export type LetterResult = "correct" | "present" | "absent";

/**
 * Score a five-letter guess. Exact matches are consumed first, then remaining
 * letters can match only one occurrence in the answer.
 */
export function checkGuess(answer: string, guess: string): LetterResult[] {
  const normalizedAnswer = answer.toLowerCase();
  const normalizedGuess = guess.toLowerCase();
  const result: LetterResult[] = Array(5).fill("absent");
  const remaining = normalizedAnswer.split("");

  for (let i = 0; i < 5; i += 1) {
    if (normalizedGuess[i] === normalizedAnswer[i]) {
      result[i] = "correct";
      remaining[i] = "";
    }
  }

  for (let i = 0; i < 5; i += 1) {
    if (result[i] === "correct") continue;
    const matchingIndex = remaining.indexOf(normalizedGuess[i]);
    if (matchingIndex !== -1) {
      result[i] = "present";
      remaining[matchingIndex] = "";
    }
  }

  return result;
}
```

## `app/actions/admin.ts`

```typescript

"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { requireAdmin } from "@/lib/session";
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
  await requireAdmin("/admin");
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
  await requireAdmin("/admin");
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
```

## `app/actions/game.ts`

```typescript
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
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
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/play?puzzleId=${id}`)}`);
  const db = getDb();
  const [puzzle] = await db.select({ id: puzzles.id }).from(puzzles)
    .where(and(eq(puzzles.id, id), eq(puzzles.published, 1))).limit(1);
  if (!puzzle) redirect("/");
  const [game] = await db.insert(games).values({ puzzleId: id, ownerId: user.id }).returning({ id: games.id });
  redirect(`/game/${game.id}`);
}

export async function submitGuess(gameId: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(`/game/${gameId}`);
  const raw = String(formData.get("guess") ?? "");
  const parsedId = gameIdSchema.safeParse(gameId);
  const parsedGuess = guessSchema.safeParse(raw);
  if (!parsedId.success) return { error: "Game not found." };
  if (!parsedGuess.success) return { fieldErrors: { guess: ["Enter exactly five letters (A–Z)."] }, values: { guess: raw } };

  try {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [game] = await tx.select().from(games)
        .where(and(eq(games.id, parsedId.data), eq(games.ownerId, user.id))).for("update").limit(1);
      if (!game) return { error: "Game not found." as const };
      if (game.status !== "playing" || game.guesses.length >= 6) return { error: "This game has already finished." as const };
      const [puzzle] = await tx.select().from(puzzles).where(eq(puzzles.id, game.puzzleId)).limit(1);
      if (!puzzle) return { error: "Game not found." as const };
      const word = parsedGuess.data;
      const guesses = [...game.guesses, { word, results: checkGuess(puzzle.answer, word) }];
      const won = word === puzzle.answer;
      const status = won ? "won" : guesses.length === 6 ? "lost" : "playing";
      await tx.update(games).set({ guesses, status, ...(status !== "playing" ? { finishedAt: new Date() } : {}) }).where(eq(games.id, game.id));
      return { status, won, answer: status === "lost" ? puzzle.answer : undefined };
    });
    if ("error" in result) return { error: result.error };
    revalidatePath(`/game/${gameId}`);
    return { message: result.status === "playing" ? "Guess saved." : result.won ? "You won!" : `Game over. The answer was ${result.answer?.toUpperCase()}.` };
  } catch {
    return { error: "We couldn't save your guess. Please try again.", values: { guess: raw } };
  }
}

export async function saveScore(gameId: string, _previous: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await requireUser(`/game/${gameId}`);
  const id = gameIdSchema.safeParse(gameId);
  if (!id.success) return { error: "Game not found." };
  try {
    const db = getDb();
    const [game] = await db.select().from(games).where(and(eq(games.id, id.data), eq(games.ownerId, user.id))).limit(1);
    if (!game) return { error: "Game not found." };
    if (game.status === "playing") return { error: "Finish the game before saving a score." };
    if (game.status !== "won") return { message: "Only winning games can be saved to the leaderboard." };
    const inserted = await db.insert(scores).values({
      gameId: game.id, ownerId: user.id, puzzleId: game.puzzleId,
      nickname: user.name.slice(0, 20), attempts: game.guesses.length,
    }).onConflictDoNothing({ target: scores.gameId }).returning({ id: scores.id });
    if (!inserted.length) return { message: "This game's score has already been saved." };
    revalidatePath(`/puzzle/${game.puzzleId}`);
    revalidatePath("/hall-of-fame");
    revalidatePath("/my-games");
    return { message: "Your score was saved!" };
  } catch {
    return { error: "We couldn't save your score. Please try again." };
  }
}
```

## `app/actions/users.ts`

```typescript
"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { user } from "@/db/auth-schema";
import { requireAdmin } from "@/lib/session";

export async function toggleUserRole(formData: FormData) {
  const current = await requireAdmin("/users");
  const targetId = String(formData.get("userId") ?? "");
  if (!targetId || targetId === current.id) redirect("/users");
  const db = getDb();
  const [target] = await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.id, targetId)).limit(1);
  if (!target || (target.role !== "admin" && target.role !== "player")) redirect("/users");
  await db.update(user).set({ role: target.role === "admin" ? "player" : "admin", updatedAt: new Date() }).where(eq(user.id, targetId));
  revalidatePath("/users");
  revalidatePath("/admin");
  redirect("/users");
}
```

## `app/admin/page.tsx`

```tsx
import { togglePublished } from "@/app/actions/admin";
import { AddPuzzleForm } from "@/components/add-puzzle-form";
import { ActionSubmit } from "@/components/action-submit";
import { getAdminPuzzles } from "@/db/queries";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
    await requireAdmin("/admin");
    const rows = await getAdminPuzzles();
    
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-black">Admin area</h1>
        <p className="mt-2 text-sm text-amber-700">
          Manage puzzles and publication status.
        </p>
      </div>
      <AddPuzzleForm />
      <div className="space-y-3">
        <h2 className="text-xl font-bold">All puzzles</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">#</th>
                <th className="p-2">Word</th>
                <th className="p-2">Difficulty</th>
                <th className="p-2">Status</th>
                <th className="p-2">Played / won</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.id}</td>
                  <td className="p-2 font-mono uppercase">{row.answer}</td>
                  <td className="p-2 capitalize">{row.difficulty}</td>
                  <td className="p-2">
                    {row.published ? "Published" : "Unpublished"}
                  </td>
                  <td className="p-2">
                    {row.played} / {row.won}
                  </td>
                  <td className="p-2">
                    <form action={togglePublished}>
                      <input type="hidden" name="puzzleId" value={row.id} />
                      <ActionSubmit
                        idle={row.published ? "Unpublish" : "Publish"}
                        pending="Updating…"
                      />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
```

## `app/api/auth/[...all]/route.ts`

```typescript
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/db/auth";
export const { GET, POST } = toNextJsHandler(auth);
```

## `app/game/[id]/page.tsx`

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GuessForm } from "@/components/guess-form";
import { SaveScoreForm } from "@/components/save-score-form";
import { Button } from "@/components/ui/button";
import { startGame } from "@/app/actions/game";
import { getDb } from "@/db";
import { games, puzzles } from "@/db/schema";
import { getNextPuzzleId } from "@/db/queries";
import { gameIdSchema } from "@/lib/validation";
import type { LetterResult } from "@/lib/wordle";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
const tileStyles: Record<LetterResult, string> = {
  correct: "border-green-700 bg-green-600 text-white",
  present: "border-yellow-500 bg-yellow-300 text-slate-950",
  absent: "border-slate-500 bg-slate-500 text-white",
};

export default async function GamePage({params}: {params: Promise<{ id: string }>}) {

  const { id } = await params;
  const currentUser = await requireUser(`/game/${id}`);

  if (!gameIdSchema.safeParse(id).success) notFound();

  const db = getDb();

  const [game] = await db.select().from(games).where(and(eq(games.id, id), eq(games.ownerId, currentUser.id))).limit(1);
  if (!game) notFound();

  const [puzzle] = await db
    .select()
    .from(puzzles)
    .where(eq(puzzles.id, game.puzzleId))
    .limit(1);

  if (!puzzle) notFound();

  const answer = game.status === "lost" ? puzzle.answer : null;
  
  const nextPuzzleId =
    game.status !== "playing" ? await getNextPuzzleId(game.puzzleId) : null;

  return (
    <section className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <Link
          href={`/puzzle/${game.puzzleId}`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Puzzle #{game.puzzleId}
        </Link>
        <h1 className="text-2xl font-black">Game</h1>
        <p className="text-muted-foreground text-sm">
          Your progress is saved on the server.
        </p>
      </div>
      <div className="space-y-2" aria-label="Six attempts, five letters each">
        {Array.from({ length: 6 }, (_, row) => {
          const attempt = game.guesses[row];
          return (
            <div
              key={row}
              className="grid grid-cols-5 gap-2"
              aria-label={`Attempt ${row + 1}`}
            >
              {Array.from({ length: 5 }, (_, col) => {
                const letter = attempt?.word[col] ?? "";
                const result = attempt?.results[col];
                return (
                  <div
                    key={col}
                    role="img"
                    aria-label={
                      result
                        ? `${letter.toUpperCase()}: ${result}`
                        : `Attempt ${row + 1}, letter ${col + 1}: empty`
                    }
                    className={`flex aspect-square items-center justify-center rounded-md border-2 text-2xl font-extrabold uppercase ${result ? tileStyles[result] : "border-border bg-card"}`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground text-center text-sm">
        Attempts used: {game.guesses.length} / 6
      </p>
      {game.status === "playing" ? (
        <GuessForm
          key={game.guesses.length}
          gameId={game.id}
          disabled={game.status !== "playing"}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {game.status === "won" ? "Congratulations!" : "Game over"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {game.status === "lost" && (
              <p>
                The correct word was{" "}
                <strong className="tracking-widest">
                  {answer?.toUpperCase()}
                </strong>
                .
              </p>
            )}
            {game.status === "won" && (
              <p>
                You solved it in {game.guesses.length}{" "}
                {game.guesses.length === 1 ? "attempt" : "attempts"}.
              </p>
            )}
            {game.status === "won" && <SaveScoreForm gameId={game.id} />}
            <Link
              href={`/puzzle/${game.puzzleId}`}
              className="block text-sm underline"
            >
              Puzzle leaderboard
            </Link>
            {nextPuzzleId !== null ? (
              <form action={startGame} className="pt-2">
                <input type="hidden" name="puzzleId" value={nextPuzzleId} />
                <Button type="submit" className="w-full">
                  Next puzzle #{nextPuzzleId}
                </Button>
              </form>
            ) : (
              <Link href="/" className="block pt-2 text-sm underline">
                Back to puzzle list
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
```

## `app/globals.css`

```css
@import "tailwindcss";

:root {
  --background: #fafaf8;
  --foreground: #20211f;
  --card: #ffffff;
  --card-foreground: #20211f;
  --primary: #285d4d;
  --primary-foreground: #ffffff;
  --muted: #f0f0ec;
  --muted-foreground: #686b66;
  --accent: #edf3ef;
  --border: #dedfd9;
  --input: #cfd1ca;
  --ring: #518674;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

* {
  box-sizing: border-box;
}
html {
  min-height: 100%;
}
body {
  min-height: 100vh;
}
button,
input {
  font: inherit;
}
::selection {
  background: #d9e8df;
}
```

## `app/hall-of-fame/page.tsx`

```tsx
import Link from "next/link";
import { getHallOfFame } from "@/db/queries";
export const dynamic = "force-dynamic";

export default async function HallOfFamePage() {

    const rows = await getHallOfFame();
    
  return (
    <section className="mx-auto max-w-xl space-y-5">
      <Link href="/" className="text-sm underline">
        ← All puzzles
      </Link>
      <h1 className="text-3xl font-black">Hall of Fame</h1>
      <p className="text-muted-foreground text-sm">
        Top 10 players by total puzzles won.
      </p>
      {rows.length ? (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">#</th>
              <th className="p-2">Player</th>
              <th className="p-2">Puzzles won</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.nickname} className="border-b">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">{row.nickname}</td>
                <td className="p-2">{row.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No winners yet.</p>
      )}
    </section>
  );
}
```

## `app/layout.tsx`

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Word Game — Five Letters",
  description:
    "A Wordle-style game. Guess the five-letter word in six attempts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground flex min-h-screen flex-col antialiased">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
```

## `app/my-games/page.tsx`

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getMyGames, getMyGameStats } from "@/db/queries";
export const dynamic = "force-dynamic";
export default async function MyGamesPage() {
  await requireUser("/my-games");
  const [games, stats] = await Promise.all([getMyGames(), getMyGameStats()]);
  return <section className="space-y-5"><h1 className="text-3xl font-black">My games</h1><p className="text-muted-foreground">Played: {stats.played} · Won: {stats.won}</p>
    {games.length ? <div className="space-y-3">{games.map(game => <article key={game.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><h2 className="font-bold">Puzzle #{game.puzzleId}</h2><p className="text-muted-foreground text-sm capitalize">{game.status} · {game.attempts} attempts · {game.createdAt.toLocaleString()}</p></div><Link href={`/game/${game.id}`} className="underline">{game.status === "playing" ? "Continue" : "View game"}</Link></article>)}</div> : <p>You have not played any games yet.</p>}
  </section>;
}
```

## `app/not-allowed/page.tsx`

```tsx
import Link from "next/link";
export default function NotAllowedPage() {
  return <section className="mx-auto max-w-lg space-y-4 text-center"><h1 className="text-3xl font-black">Not allowed</h1><p className="text-muted-foreground">Your account does not have permission to open this page.</p><Link href="/" className="underline">Back to the puzzle list</Link></section>;
}
```

## `app/not-found.tsx`

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 py-12 text-center">
      <h1 className="text-3xl font-black">Page not found</h1>
      <p className="text-muted-foreground">
        That page doesn’t exist. You can return to the puzzle list.
      </p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90"
      >
        Back to puzzles
      </Link>
    </div>
  );
}
```

## `app/page.tsx`

```tsx
import Link from "next/link";
import { startGame } from "@/app/actions/game";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPuzzleNumbers } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const puzzleList = await getPuzzleNumbers();

  return (
    
    <div className="space-y-9">
      <section className="space-y-3 text-center">
        <p className="text-primary text-xs font-bold tracking-[0.25em] uppercase">
          A little word challenge
        </p>
        <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
          Guess the secret word
        </h1>
        <p className="text-muted-foreground mx-auto max-w-xl">
          Find the hidden five-letter word in six tries. Every guess gives you
          clues.
        </p>
      </section>

      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>How to play</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm sm:text-base">
          <p>
            Enter a five-letter word. The tiles show how close your guess was.
          </p>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded border-2 border-green-700 bg-green-600 font-bold text-white"
            >
              A
            </span>
            <span>
              <strong>Correct</strong> — the letter is in the right position.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded border-2 border-yellow-500 bg-yellow-300 font-bold text-slate-950"
            >
              B
            </span>
            <span>
              <strong>Present</strong> — the letter is in the word, but
              elsewhere.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded border-2 border-slate-500 bg-slate-500 font-bold text-white"
            >
              C
            </span>
            <span>
              <strong>Absent</strong> — the letter isn’t available in the
              answer.
            </span>
          </div>
          <p className="text-muted-foreground">
            Repeated letters count only as many times as they appear in the
            answer.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold">Choose a puzzle</h2>
          <span className="text-muted-foreground text-sm">
            {puzzleList.length} available
          </span>
        </div>
        {puzzleList.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {puzzleList.map(({ id, difficulty }) => (
              <div
                key={id}
                className="border-border bg-card rounded-xl border p-4 text-center"
              >
                <p className="font-semibold">Puzzle #{id}</p>
                <p className="text-muted-foreground mb-3 text-xs capitalize">
                  {difficulty}
                </p>
                <form action={startGame}>
                  <input type="hidden" name="puzzleId" value={id} />
                  <button className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-semibold">
                    Play
                  </button>
                </form>
                <Link
                  href={`/puzzle/${id}`}
                  className="mt-2 block text-xs underline"
                >
                  Leaderboard
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            No puzzles found. Run <code>npm run db:seed</code> to load the
            puzzles.
          </p>
        )}
      </section>
    </div>
  );
}
```

## `app/play/page.tsx`

```tsx
import { and, eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { getDb } from "@/db";
import { games, puzzles } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { puzzleIdSchema } from "@/lib/validation";

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ puzzleId?: string }> }) {
  const params = await searchParams;
  const parsed = puzzleIdSchema.safeParse(params.puzzleId ?? "");
  if (!parsed.success) notFound();
  const user = await requireUser(`/play?puzzleId=${parsed.data}`);
  const db = getDb();
  const [puzzle] = await db.select({ id: puzzles.id }).from(puzzles)
    .where(and(eq(puzzles.id, parsed.data), eq(puzzles.published, 1))).limit(1);
  if (!puzzle) notFound();
  const [game] = await db.insert(games).values({ puzzleId: puzzle.id, ownerId: user.id }).returning({ id: games.id });
  redirect(`/game/${game.id}`);
}
```

## `app/puzzle/[id]/not-found.tsx`

```tsx
import Link from "next/link";

export default function PuzzleNotFound() {
  return (
    <div className="space-y-4 py-12 text-center">
      <p className="text-primary text-sm font-bold tracking-[0.2em] uppercase">
        404 · Not found
      </p>
      <h1 className="text-3xl font-black">Puzzle not found</h1>
      <p className="text-muted-foreground mx-auto max-w-md">
        We couldn’t find that puzzle. The number may be invalid, or the puzzle
        may not exist.
      </p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90"
      >
        Back to puzzle list
      </Link>
    </div>
  );
}
```

## `app/puzzle/[id]/page.tsx`

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPuzzle } from "@/db/queries";
import { getPuzzleLeaderboard } from "@/db/queries";
import { puzzleIdSchema } from "@/lib/validation";
import { startGame } from "@/app/actions/game";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PuzzlePage({params}: {params: Promise<{ id: string }>}) {

  const { id } = await params;
  const parsed = puzzleIdSchema.safeParse(id);

  if (!parsed.success) notFound();
  const puzzle = await getPublishedPuzzle(parsed.data);

  if (!puzzle) notFound();
  const leaderboard = await getPuzzleLeaderboard(puzzle.id);

  return (

    <section className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2 text-center">
        <Link href="/" className="text-muted-foreground text-sm underline">
          ← All puzzles
        </Link>
        <h1 className="text-3xl font-black">Puzzle #{puzzle.id}</h1>
        <p className="text-muted-foreground text-sm capitalize">
          Difficulty: {puzzle.difficulty}
        </p>
        {puzzle.hint && <p className="text-sm">Hint: {puzzle.hint}</p>}
        <form action={startGame}>
          <input type="hidden" name="puzzleId" value={puzzle.id} />
          <Button type="submit">Play</Button>
        </form>
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-bold">Top 10 winners</h2>
        {leaderboard.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Player</th>
                  <th className="p-2">Attempts</th>
                  <th className="p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr
                    key={`${row.nickname}-${row.createdAt.toISOString()}-${i}`}
                    className="border-b"
                  >
                    <td className="p-2">{row.nickname}</td>
                    <td className="p-2">{row.attempts}</td>
                    <td className="p-2">
                      {row.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No winning scores yet.
          </p>
        )}
      </div>
    </section>
  );
}
```

## `app/sign-in/page.tsx`

```tsx
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/safe-next";
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  const githubEnabled = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  return <AuthForm mode="sign-in" next={safeNext(params.next)} githubEnabled={githubEnabled} />;
}
```

## `app/sign-up/page.tsx`

```tsx
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/safe-next";
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  const githubEnabled = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  return <AuthForm mode="sign-up" next={safeNext(params.next)} githubEnabled={githubEnabled} />;
}
```

## `app/users/page.tsx`

```tsx
import { toggleUserRole } from "@/app/actions/users";
import { ActionSubmit } from "@/components/action-submit";
import { getUsers } from "@/db/queries";
import { requireAdmin } from "@/lib/session";
export const dynamic = "force-dynamic";
export default async function UsersPage() {
  const current = await requireAdmin("/users");
  const users = await getUsers();
  return <section className="space-y-5"><h1 className="text-3xl font-black">Users</h1><p className="text-muted-foreground text-sm">Promote players or demote other admins. You cannot change your own role.</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Action</th></tr></thead><tbody>{users.map(item => <tr key={item.id} className="border-b"><td className="p-2">{item.name}</td><td className="p-2">{item.email}</td><td className="p-2">{item.role}</td><td className="p-2">{item.id === current.id ? "Your account" : <form action={toggleUserRole}><input type="hidden" name="userId" value={item.id}/><ActionSubmit idle={item.role === "admin" ? "Make player" : "Make admin"} pending="Updating…"/></form>}</td></tr>)}</tbody></table></div>
  </section>;
}
```

## `components/action-submit.tsx`

```tsx
"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
export function ActionSubmit({
  idle,
  pending,
}: {
  idle: string;
  pending: string;
    }) {
    
  const { pending: isPending } = useFormStatus();
  return (
    <Button type="submit" disabled={isPending} className="w-full">
      {isPending ? pending : idle}
    </Button>
  );
}
```

## `components/add-puzzle-form.tsx`

```tsx
"use client";
import { useActionState } from "react";
import { addPuzzle } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/game";
import { ActionSubmit } from "@/components/action-submit";
import { Input } from "@/components/ui/input";

export function AddPuzzleForm() {
    
  const [state, formAction] = useActionState<ActionState, FormData>(addPuzzle,{});
  const value = (name: string) => state.values?.[name] ?? "";

    return (
      
    <form action={formAction} className="space-y-4 rounded-xl border p-5">
      <h2 className="text-lg font-bold">Add puzzle</h2>
      <div>
        <label htmlFor="word" className="mb-1 block text-sm font-medium">
          Word
        </label>
        <Input
          key={value("word")}
          id="word"
          name="word"
          defaultValue={value("word")}
          maxLength={5}
          aria-describedby="word-error"
          aria-invalid={!!state.fieldErrors?.word}
        />
        {state.fieldErrors?.word?.map((e) => (
          <p
            id="word-error"
            key={e}
            role="alert"
            className="text-sm text-red-600"
          >
            {e}
          </p>
        ))}
      </div>
      <div>
        <label htmlFor="difficulty" className="mb-1 block text-sm font-medium">
          Difficulty
        </label>
        <select
          key={value("difficulty") || "medium"}
          id="difficulty"
          name="difficulty"
          defaultValue={value("difficulty") || "medium"}
          className="bg-background h-10 w-full rounded-md border px-3"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        {state.fieldErrors?.difficulty?.map((e) => (
          <p key={e} role="alert" className="text-sm text-red-600">
            {e}
          </p>
        ))}
      </div>
      <div>
        <label htmlFor="hint" className="mb-1 block text-sm font-medium">
          Hint (optional)
        </label>
        <Input
          key={value("hint")}
          id="hint"
          name="hint"
          defaultValue={value("hint")}
          maxLength={140}
          aria-describedby="hint-error"
        />
        {state.fieldErrors?.hint?.map((e) => (
          <p
            id="hint-error"
            key={e}
            role="alert"
            className="text-sm text-red-600"
          >
            {e}
          </p>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked /> Publish now
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <ActionSubmit idle="Add puzzle" pending="Saving…" />
    </form>
  );
}
```

## `components/auth-form.tsx`

```tsx
"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm({ mode, next, githubEnabled }: { mode: "sign-in" | "sign-up"; next: string; githubEnabled: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    try {
      const result = mode === "sign-up"
        ? await signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: next })
        : await signIn.email({ email: email.trim(), password, callbackURL: next });
      if (result.error) setError(mode === "sign-in" ? "Invalid email or password." : result.error.message || "We couldn't create your account. Please try again.");
      else { router.push(next); router.refresh(); }
    } catch { setError(mode === "sign-in" ? "Invalid email or password." : "We couldn't create your account. Please try again."); }
    finally { setPending(false); setPassword(""); }
  }
  async function github() {
    setError(""); setPending(true);
    try { await signIn.social({ provider: "github", callbackURL: next }); }
    catch { setError("We couldn't sign in with GitHub. Please try again."); setPending(false); }
  }
  return <section className="mx-auto max-w-sm space-y-5">
    <div><h1 className="text-3xl font-black">{mode === "sign-up" ? "Create account" : "Sign in"}</h1><p className="text-muted-foreground mt-2 text-sm">{mode === "sign-up" ? "Create an account to save your games." : "Welcome back to Word Game."}</p></div>
    <form onSubmit={submit} className="space-y-4">
      {mode === "sign-up" && <div><label htmlFor="name" className="mb-1 block text-sm font-medium">Name</label><Input id="name" value={name} onChange={e => setName(e.target.value)} required maxLength={80} autoComplete="name" /></div>}
      <div><label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
      <div><label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} /><p className="text-muted-foreground mt-1 text-xs">At least 8 characters.</p></div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Please wait…" : mode === "sign-up" ? "Create account" : "Sign in"}</Button>
    </form>
    {githubEnabled && <Button type="button" variant="outline" disabled={pending} className="w-full" onClick={github}>Continue with GitHub</Button>}
    <p className="text-sm">{mode === "sign-up" ? "Already have an account? " : "New here? "}<Link className="underline" href={`${mode === "sign-up" ? "/sign-in" : "/sign-up"}?next=${encodeURIComponent(next)}`}>{mode === "sign-up" ? "Sign in" : "Create an account"}</Link></p>
  </section>;
}
```

## `components/footer.tsx`

```tsx
export function Footer() {
  return (
    <footer className="border-border text-muted-foreground mt-12 border-t py-6 text-center text-sm">
      Six guesses. Five letters. Good luck!
    </footer>
  );
}
```

## `components/guess-form.tsx`

```tsx
"use client";
import { useActionState } from "react";
import { submitGuess, type ActionState } from "@/app/actions/game";
import { ActionSubmit } from "@/components/action-submit";
import { Input } from "@/components/ui/input";

export function GuessForm({
  gameId,
  disabled,
}: {
  gameId: string;
  disabled: boolean;
}) {
  const action = submitGuess.bind(null, gameId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action,{});
    
  return (
    
    <form action={formAction} className="space-y-3">
      <label htmlFor="guess" className="block text-sm font-semibold">
        Your five-letter guess
      </label>
      <Input
        key={state.values?.guess ?? "initial"}
        id="guess"
        name="guess"
        defaultValue={state.values?.guess ?? ""}
        maxLength={5}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="CRANE"
        aria-invalid={!!state.fieldErrors?.guess}
        aria-describedby={
          state.fieldErrors?.guess ? "guess-error" : "guess-help"
        }
        disabled={disabled || pending}
        className="text-center text-lg font-bold tracking-[0.3em] uppercase"
      />
      <p id="guess-help" className="text-muted-foreground text-xs">
        Use letters A–Z. Press Enter to submit.
      </p>
      {state.fieldErrors?.guess?.map((message) => (
        <p
          id="guess-error"
          key={message}
          role="alert"
          className="text-sm text-red-600"
        >
          {message}
        </p>
      ))}
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}
      <ActionSubmit idle="Submit guess" pending="Checking…" />
    </form>
  );
}
```

## `components/header.tsx`

```tsx
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

export async function Header() {
  const user = await getCurrentUser();
  return <header className="border-border bg-card/80 border-b">
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
      <Link href="/" className="text-xl font-black tracking-tight">WORD GAME<span className="text-primary">.</span></Link>
      <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-2">
        <Link href="/" className="text-muted-foreground hover:bg-accent rounded-md px-3 py-2 text-sm">Puzzle list</Link>
        <Link href="/hall-of-fame" className="hover:bg-accent rounded-md px-3 py-2 text-sm">Hall of Fame</Link>
        {user && <Link href="/my-games" className="hover:bg-accent rounded-md px-3 py-2 text-sm">My games</Link>}
        {user?.role === "admin" && <><Link href="/admin" className="hover:bg-accent rounded-md px-3 py-2 text-sm">Admin</Link><Link href="/users" className="hover:bg-accent rounded-md px-3 py-2 text-sm">Users</Link></>}
        {user ? <><span className="px-2 text-sm font-medium">{user.name}</span><SignOutButton /></> : <Link href="/sign-in" className="rounded-md px-3 py-2 text-sm font-semibold underline">Sign in</Link>}
      </nav>
    </div>
  </header>;
}
```

## `components/save-score-form.tsx`

```tsx
"use client";
import { useActionState } from "react";
import { saveScore, type ActionState } from "@/app/actions/game";
import { ActionSubmit } from "@/components/action-submit";

export function SaveScoreForm({ gameId }: { gameId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveScore.bind(null, gameId), {});
  return <form action={formAction} className="space-y-3">
    <p className="text-sm">Your score will be saved under your account name.</p>
    {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    {state.message && <p role="status" className="text-sm">{state.message}</p>}
    <ActionSubmit idle="Save score" pending="Saving…" />
  </form>;
}
```

## `components/sign-out-button.tsx`

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function logout() {
    setPending(true);
    try { await signOut(); router.push("/"); router.refresh(); }
    finally { setPending(false); }
  }
  return <Button type="button" variant="outline" disabled={pending} onClick={logout}>{pending ? "Signing out…" : "Sign out"}</Button>;
}
```

## `components/ui/button.tsx`

```tsx
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
};

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonProps) {
  const variants = {
    default: "bg-primary text-primary-foreground hover:opacity-90",
    outline: "border border-input bg-background hover:bg-accent",
    ghost: "hover:bg-accent",
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
```

## `components/ui/card.tsx`

```tsx
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-xl border shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 p-5", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg leading-none font-semibold tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}
```

## `components/ui/input.tsx`

```tsx
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-11 w-full rounded-md border px-3 py-2 text-base outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
```

## `drizzle/0000_abnormal_surge.sql`

```sql
CREATE TABLE "puzzles" (
	"id" integer PRIMARY KEY NOT NULL,
	"answer" varchar(5) NOT NULL
);
```

## `drizzle/0001_server_games.sql`

```sql
ALTER TABLE "puzzles"
ADD COLUMN "difficulty" varchar(10) NOT NULL DEFAULT 'medium';
ALTER TABLE "puzzles"
ADD COLUMN "hint" varchar(140);
ALTER TABLE "puzzles"
ADD COLUMN "published" integer NOT NULL DEFAULT 1;
ALTER TABLE "puzzles"
ADD COLUMN "created_at" timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE "puzzles"
ADD CONSTRAINT "puzzles_answer_unique" UNIQUE ("answer");
CREATE TABLE "games" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "puzzle_id" integer NOT NULL REFERENCES "puzzles"("id"),
    "status" varchar(10) NOT NULL DEFAULT 'playing',
    "guesses" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "finished_at" timestamp with time zone
);
CREATE TABLE "scores" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "game_id" uuid NOT NULL REFERENCES "games"("id"),
    "puzzle_id" integer NOT NULL REFERENCES "puzzles"("id"),
    "nickname" varchar(20) NOT NULL,
    "attempts" integer NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "scores_game_id_unique" ON "scores" ("game_id");
```

## `drizzle/0002_great_betty_ross.sql`

```sql
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"puzzle_id" integer NOT NULL,
	"status" varchar(10) DEFAULT 'playing' NOT NULL,
	"guesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"puzzle_id" integer NOT NULL,
	"nickname" varchar(20) NOT NULL,
	"attempts" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "puzzles" ADD COLUMN "difficulty" varchar(10) DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "puzzles" ADD COLUMN "hint" varchar(140);--> statement-breakpoint
ALTER TABLE "puzzles" ADD COLUMN "published" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "puzzles" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_puzzle_id_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."puzzles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_puzzle_id_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."puzzles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scores_game_id_unique" ON "scores" USING btree ("game_id");--> statement-breakpoint
ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_answer_unique" UNIQUE("answer");
```

## `drizzle/0003_auth_ownership.sql`

```sql
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "role" text NOT NULL DEFAULT 'player',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expires_at" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamptz,
  "refresh_token_expires_at" timestamptz,
  "scope" text,
  "password" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Homework 2 games/scores had no owner. Remove only those unowned records so the new NOT NULL
-- ownership rules are honest; puzzles and their leaderboards' puzzle metadata remain intact.
DELETE FROM scores;
--> statement-breakpoint
DELETE FROM games;
--> statement-breakpoint
ALTER TABLE games ADD COLUMN IF NOT EXISTS owner_id text;
--> statement-breakpoint
ALTER TABLE scores ADD COLUMN IF NOT EXISTS owner_id text;
--> statement-breakpoint
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_owner_id_user_id_fk;
--> statement-breakpoint
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_owner_id_user_id_fk;
--> statement-breakpoint
ALTER TABLE games ADD CONSTRAINT games_owner_id_user_id_fk FOREIGN KEY (owner_id) REFERENCES "user"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE scores ADD CONSTRAINT scores_owner_id_user_id_fk FOREIGN KEY (owner_id) REFERENCES "user"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE games ALTER COLUMN owner_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE scores ALTER COLUMN owner_id SET NOT NULL;
--> statement-breakpoint
```

## `.env.example`

```bash
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ADMIN_EMAIL=
```

## `.gitignore`

```text
node_modules/
.next/
out/
build/
coverage/
.env
.env.*
!.env.example
*.log
.DS_Store
*.tsbuildinfo
```

## `.nvmrc`

```text
22
```

## `.prettierignore`

```text
.next
out
build
node_modules
package-lock.json
drizzle
next-env.d.ts
```

## `.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "useTabs": false,
  "trailingComma": "all",
  "printWidth": 80,
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

## `components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {}
}
```

## `drizzle.config.ts`

```typescript
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not configured. Add it to .env first.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: ["./db/schema.ts", "./db/auth-schema.ts"],
  out: "./drizzle",
  dbCredentials: { url },
});
```

## `eslint.config.mjs`

```javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
]);
```

## `next-env.d.ts`

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/dev/types/routes.d.ts";
import "./.next/dev/types/root-params.d.ts";

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

## `next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};
export default nextConfig;
```

## `package.json`

```json
{
  "name": "word-game",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier . --write",
    "format:check": "prettier . --check",
    "check": "npm run lint && npm run format:check",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx db/seed.ts",
    "test:wordle": "tsx scripts/test-wordle.ts",
    "db:make-admin": "tsx scripts/make-admin.ts"
  },
  "dependencies": {
    "@next/env": "16.3.6",
    "@radix-ui/react-slot": "^1.2.3",
    "@typescript-eslint/typescript-estree": "^8.71.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "drizzle-orm": "0.45.0",
    "lucide-react": "^0.468.0",
    "next": "16.3.6",
    "pg": "^8.16.3",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "server-only": "^0.0.1",
    "tailwind-merge": "^3.3.1",
    "zod": "^4.1.12",
    "better-auth": "^1.7.11",
    "@better-auth/drizzle-adapter": "^1.7.11"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.17",
    "@types/node": "^22.15.30",
    "@types/pg": "^8.15.5",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "drizzle-kit": "0.31.5",
    "eslint": "^9.39.5",
    "eslint-config-next": "16.3.6",
    "eslint-config-prettier": "^10.1.8",
    "prettier": "^3.9.10",
    "prettier-plugin-tailwindcss": "^0.8.1",
    "tailwindcss": "^4.1.17",
    "tsx": "^4.20.6",
    "typescript": "^6.0.3"
  }
}
```

## `postcss.config.mjs`

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

## `proxy.ts`

```typescript
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // This is only an early redirect. The cookie may be forged; server pages/actions verify it with Better Auth.
  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/admin/:path*", "/users/:path*", "/my-games/:path*", "/game/:path*"] };
```

## `scripts/make-admin.ts`

```typescript
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { user } from "../db/auth-schema";

loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!connectionString) throw new Error("DATABASE_URL is not configured.");
if (!email) throw new Error("Set ADMIN_EMAIL to the email of an account that has already signed up.");

async function main() {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool });
  try {
    const [account] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.email, email)).limit(1);
    if (!account) throw new Error("No account has that email. Sign up in the app first, then run this command.");
    await db.update(user).set({ role: "admin", updatedAt: new Date() }).where(eq(user.id, account.id));
    process.stdout.write(`Admin role granted to ${account.email}.\n`);
  } finally {
    await pool.end();
  }
}
main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Could not grant admin role."}\n`);
  process.exitCode = 1;
});
```

## `scripts/test-wordle.ts`

```typescript
import assert from "node:assert/strict";
import { checkGuess, type LetterResult } from "../lib/wordle";

const cases: Array<{
  answer: string;
  guess: string;
  expected: LetterResult[];
}> = [
  {
    answer: "crane",
    guess: "crane",
    expected: ["correct", "correct", "correct", "correct", "correct"],
  },
  {
    answer: "alloy",
    guess: "llama",
    expected: ["present", "correct", "present", "absent", "absent"],
  },
  {
    answer: "speed",
    guess: "erase",
    expected: ["present", "absent", "absent", "present", "present"],
  },
  {
    answer: "apple",
    guess: "eagle",
    expected: ["absent", "present", "absent", "correct", "correct"],
  },
];

for (const testCase of cases) {
  assert.deepEqual(
    checkGuess(testCase.answer, testCase.guess),
    testCase.expected,
  );
  process.stdout.write(`PASS ${testCase.answer} / ${testCase.guess}\n`);
}
process.stdout.write("All Wordle colour tests passed.\n");
```

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    ".next/types/**/*.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

