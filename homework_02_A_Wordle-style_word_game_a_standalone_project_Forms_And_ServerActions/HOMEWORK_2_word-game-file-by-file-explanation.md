# Homework 2 — Word Game: code and file-by-file explanation

This document describes the Homework 2 implementation.

## Architecture

- **Next.js Server Components** read the database and render persisted state.
- **Server Actions** receive forms, validate untrusted input with Zod, and mutate the database.
- **Drizzle + PostgreSQL** persist games, guesses, puzzle metadata and scores.
- **Client Components** are limited to forms that need pending state and field feedback.
- The secret answer is read only on the server. During a running game, the page renders only the game ID/status/guesses and does not pass the answer into a Client Component.

## File-by-file explanation and complete changed code

### `db/schema.ts`

Defines the database tables. `puzzles` stores answer and admin metadata; `games` stores the game status and guesses as JSONB; `scores` stores winners. The unique answer constraint prevents duplicate words, and the unique index on `gameId` allows only one score per game.

```typescript
import { integer, jsonb, pgTable, text, timestamp, uuid, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import type { LetterResult } from "@/lib/wordle";

export const puzzles = pgTable("puzzles", {
  id: integer("id").primaryKey(),
  answer: varchar("answer", { length: 5 }).notNull().unique(),
  difficulty: varchar("difficulty", { length: 10 }).notNull().default("medium"),
  hint: varchar("hint", { length: 140 }),
  published: integer("published").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Puzzle = typeof puzzles.$inferSelect;

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  puzzleId: integer("puzzle_id").notNull().references(() => puzzles.id),
  status: varchar("status", { length: 10 }).notNull().default("playing"),
  guesses: jsonb("guesses").$type<{ word: string; results: LetterResult[] }[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const scores = pgTable("scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  puzzleId: integer("puzzle_id").notNull().references(() => puzzles.id),
  nickname: varchar("nickname", { length: 20 }).notNull(),
  attempts: integer("attempts").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("scores_game_id_unique").on(table.gameId)]);

export const PuzzleDifficulty = ["easy", "medium", "hard"] as const;
export type PuzzleDifficulty = (typeof PuzzleDifficulty)[number];
```

### `db/queries.ts`

Contains server-only read queries. The public puzzle list selects only IDs and difficulty, never answers. Leaderboard queries return winners only because only winning games can be inserted into `scores`. The admin query counts games and wins.

```typescript
import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { games, puzzles, scores } from "@/db/schema";

export async function getPuzzleNumbers() {
  return getDb().select({ id: puzzles.id, difficulty: puzzles.difficulty })
    .from(puzzles).where(eq(puzzles.published, 1)).orderBy(asc(puzzles.id));
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
export async function getGame(id: string) {
  const [game] = await getDb().select().from(games).where(eq(games.id, id)).limit(1);
  return game ?? null;
}
export async function getPuzzleLeaderboard(puzzleId: number) {
  return getDb().select({ nickname: scores.nickname, attempts: scores.attempts, createdAt: scores.createdAt })
    .from(scores).where(eq(scores.puzzleId, puzzleId))
    .orderBy(asc(scores.attempts), asc(scores.createdAt)).limit(10);
}
export async function getHallOfFame() {
  return getDb().select({ nickname: scores.nickname, wins: count(scores.id), lastWin: sql<Date>`max(${scores.createdAt})` })
    .from(scores).groupBy(scores.nickname).orderBy(desc(count(scores.id)), asc(sql`min(${scores.createdAt})`)).limit(10);
}
export async function getAdminPuzzles() {
  return getDb().select({
    id: puzzles.id, answer: puzzles.answer, difficulty: puzzles.difficulty,
    hint: puzzles.hint, published: puzzles.published,
    played: count(games.id),
    won: sql<number>`count(*) filter (where ${games.status} = 'won')`,
  }).from(puzzles).leftJoin(games, eq(games.puzzleId, puzzles.id))
    .groupBy(puzzles.id).orderBy(asc(puzzles.id));
}
```

### `lib/validation.ts`

Zod schemas validate route IDs, guesses, nicknames, puzzle words, difficulty, hints and game IDs. These checks run on the server; HTML attributes are just a usability aid.

```typescript
import { z } from "zod";
export const puzzleIdSchema = z.string().regex(/^[1-9]\d{0,2}$/).transform(Number).pipe(z.number().int().min(1).max(999));
export const guessSchema = z.string().trim().regex(/^[a-zA-Z]{5}$/, "Enter exactly five letters (A–Z).").transform(v => v.toLowerCase());
export const nicknameSchema = z.string().trim().min(2, "Use at least 2 characters.").max(20, "Use no more than 20 characters.").regex(/^[a-zA-Z0-9 _-]+$/, "Use only letters, numbers, spaces, hyphens, and underscores.");
export const puzzleWordSchema = z.string().trim().regex(/^[a-zA-Z]{5}$/, "Enter exactly five letters (A–Z).").transform(v => v.toLowerCase());
export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export const hintSchema = z.string().trim().max(140, "Hint must be 140 characters or fewer.");
export const gameIdSchema = z.string().uuid();
```

### `app/actions/game.ts`

Server Actions are the trust boundary. `startGame` creates a persistent game row. `submitGuess` validates input, locks the game row in a transaction, checks current server-side status, calculates colours and persists the guess. `saveScore` validates the nickname and checks game status; the database unique index handles racing duplicate saves.

```typescript
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { games, puzzles, scores } from "@/db/schema";
import { gameIdSchema, guessSchema, nicknameSchema } from "@/lib/validation";
import { checkGuess } from "@/lib/wordle";

export type ActionState = { error?: string; fieldErrors?: Record<string, string[]>; values?: Record<string, string>; message?: string };

export async function startGame(formData: FormData) {
  const id = Number(formData.get("puzzleId"));
  if (!Number.isSafeInteger(id) || id < 1) redirect("/");
  const db = getDb();
  const [puzzle] = await db.select({ id: puzzles.id }).from(puzzles)
    .where(and(eq(puzzles.id, id), eq(puzzles.published, 1))).limit(1);
  if (!puzzle) redirect("/");
  const [game] = await db.insert(games).values({ puzzleId: id }).returning({ id: games.id });
  redirect(`/game/${game.id}`);
}

export async function submitGuess(gameId: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  const raw = String(formData.get("guess") ?? "");
  const parsedId = gameIdSchema.safeParse(gameId);
  const parsedGuess = guessSchema.safeParse(raw);
  if (!parsedId.success) return { error: "Game not found.", values: { guess: raw } };
  if (!parsedGuess.success) return { fieldErrors: { guess: ["Enter exactly five letters (A–Z)."] }, values: { guess: raw } };

  try {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [game] = await tx.select().from(games).where(eq(games.id, parsedId.data)).for("update").limit(1);
      if (!game) return { error: "Game not found." };
      if (game.status !== "playing" || game.guesses.length >= 6) return { error: "This game has already finished." };
      const [puzzle] = await tx.select().from(puzzles).where(eq(puzzles.id, game.puzzleId)).limit(1);
      if (!puzzle) return { error: "Puzzle not found." };
      const word = parsedGuess.data;
      const attempt = { word, results: checkGuess(puzzle.answer, word) };
      const guesses = [...game.guesses, attempt];
      const won = word === puzzle.answer;
      const status = won ? "won" : guesses.length === 6 ? "lost" : "playing";
      await tx.update(games).set({ guesses, status, ...(status !== "playing" ? { finishedAt: new Date() } : {}) }).where(eq(games.id, game.id));
      return { status, won, guessesCount: guesses.length, answer: status === "lost" ? puzzle.answer : undefined };
    });
    if ("error" in result) return { error: result.error };
    revalidatePath(`/game/${gameId}`);
    return { message: result.status === "playing" ? "Guess saved." : result.won ? "You won!" : `Game over. The answer was ${result.answer?.toUpperCase()}.` };
  } catch {
    return { error: "We couldn't save your guess. Please try again.", values: { guess: raw } };
  }
}

export async function saveScore(gameId: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  const raw = String(formData.get("nickname") ?? "");
  const id = gameIdSchema.safeParse(gameId);
  const nickname = nicknameSchema.safeParse(raw);
  if (!id.success) return { error: "Game not found.", values: { nickname: raw } };
  if (!nickname.success) return { fieldErrors: { nickname: nickname.error.issues.map(issue => issue.message) }, values: { nickname: raw } };
  try {
    const db = getDb();
    const [game] = await db.select().from(games).where(eq(games.id, id.data)).limit(1);
    if (!game) return { error: "Game not found." };
    if (game.status === "playing") return { error: "Finish the game before saving a score." };
    if (game.status !== "won") return { message: "Only winning games can be saved to the leaderboard." };
    const [existing] = await db.select({ id: scores.id }).from(scores).where(eq(scores.gameId, game.id)).limit(1);
    if (existing) return { message: "This game's score has already been saved." };
    const inserted = await db.insert(scores).values({ gameId: game.id, puzzleId: game.puzzleId, nickname: nickname.data, attempts: game.guesses.length }).onConflictDoNothing({ target: scores.gameId }).returning({ id: scores.id });
    if (inserted.length === 0) return { message: "This game's score has already been saved." };
    revalidatePath(`/puzzle/${game.puzzleId}`);
    revalidatePath("/hall-of-fame");
    return { message: "Your score was saved!" };
  } catch {
    return { error: "We couldn't save your score. Please try again.", values: { nickname: raw } };
  }
}
```

### `app/actions/admin.ts`

Validates puzzle fields, normalizes words to lowercase and adds puzzles. PostgreSQL uniqueness is the final protection against simultaneous duplicate word submissions. `togglePublished` changes visibility and revalidates affected routes.

```typescript
"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { puzzles } from "@/db/schema";
import { difficultySchema, hintSchema, puzzleWordSchema } from "@/lib/validation";
import type { ActionState } from "@/app/actions/game";

export async function addPuzzle(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const raw = { word: String(formData.get("word") ?? ""), difficulty: String(formData.get("difficulty") ?? ""), hint: String(formData.get("hint") ?? "") };
  const word = puzzleWordSchema.safeParse(raw.word);
  const difficulty = difficultySchema.safeParse(raw.difficulty);
  const hint = hintSchema.safeParse(raw.hint);
  const fieldErrors: Record<string, string[]> = {};
  if (!word.success) fieldErrors.word = [word.error.issues[0]?.message ?? "Invalid word."];
  if (!difficulty.success) fieldErrors.difficulty = ["Choose easy, medium, or hard."];
  if (!hint.success) fieldErrors.hint = [hint.error.issues[0]?.message ?? "Invalid hint."];
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: raw };
  try {
    const db = getDb();
    const [existing] = await db.select({ id: puzzles.id }).from(puzzles).where(eq(puzzles.answer, word.data)).limit(1);
    if (existing) return { fieldErrors: { word: ["That word already exists."] }, values: raw };
    const [next] = await db.select({ id: sql<number>`coalesce(max(${puzzles.id}), 0) + 1` }).from(puzzles);
    await db.insert(puzzles).values({ id: next.id, answer: word.data, difficulty: difficulty.data, hint: hint.data || null, published: formData.get("published") === "on" ? 1 : 0 });
  } catch (error) {
    // PostgreSQL's unique constraint also handles two simultaneous submissions of the same word.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return { fieldErrors: { word: ["That word already exists."] }, values: raw };
    return { error: "We couldn't add the puzzle. Please try again.", values: raw };
  }
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function togglePublished(formData: FormData) {
  const id = Number(formData.get("puzzleId"));
  if (!Number.isSafeInteger(id) || id < 1) redirect("/admin");
  const db = getDb();
  await db.update(puzzles).set({ published: sql`case when ${puzzles.published} = 1 then 0 else 1 end` }).where(eq(puzzles.id, id));
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/puzzle/${id}`);
  redirect("/admin");
}
```

### `components/action-submit.tsx`

`useFormStatus` reads the nearest form submission status. The button is disabled and changes text while pending, preventing accidental double clicks in the UI.

```tsx
"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
export function ActionSubmit({ idle, pending }: { idle: string; pending: string }) {
  const { pending: isPending } = useFormStatus();
  return <Button type="submit" disabled={isPending} className="w-full">{isPending ? pending : idle}</Button>;
}
```

### `components/guess-form.tsx`

Client form using `useActionState` to call the Server Action. It keeps the typed guess on validation errors, associates errors with the input and displays pending/error states.

```tsx
"use client";
import { useActionState } from "react";
import { submitGuess, type ActionState } from "@/app/actions/game";
import { ActionSubmit } from "@/components/action-submit";
import { Input } from "@/components/ui/input";

export function GuessForm({ gameId, disabled }: { gameId: string; disabled: boolean }) {
  const action = submitGuess.bind(null, gameId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return <form action={formAction} className="space-y-3">
    <label htmlFor="guess" className="block text-sm font-semibold">Your five-letter guess</label>
    <Input key={state.values?.guess ?? "initial"} id="guess" name="guess" defaultValue={state.values?.guess ?? ""} maxLength={5} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="CRANE" aria-invalid={!!state.fieldErrors?.guess} aria-describedby={state.fieldErrors?.guess ? "guess-error" : "guess-help"} disabled={disabled || pending} className="text-center text-lg font-bold uppercase tracking-[0.3em]" />
    <p id="guess-help" className="text-xs text-muted-foreground">Use letters A–Z. Press Enter to submit.</p>
    {state.fieldErrors?.guess?.map(message => <p id="guess-error" key={message} role="alert" className="text-sm text-red-600">{message}</p>)}
    {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}{state.message && <p role="status" className="text-sm">{state.message}</p>}
    <ActionSubmit idle="Submit guess" pending="Checking…" />
  </form>;
}
```

### `components/save-score-form.tsx`

Nickname form using `useActionState`; it displays field-specific validation feedback and a friendly result message.

```tsx
"use client";
import { useActionState } from "react";
import { saveScore, type ActionState } from "@/app/actions/game";
import { ActionSubmit } from "@/components/action-submit";
import { Input } from "@/components/ui/input";

export function SaveScoreForm({ gameId }: { gameId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveScore.bind(null, gameId), {});
  return <form action={formAction} className="space-y-3">
    <label htmlFor="nickname" className="block text-sm font-semibold">Nickname</label>
    <Input key={state.values?.nickname ?? "initial"} id="nickname" name="nickname" defaultValue={state.values?.nickname ?? ""} minLength={2} maxLength={20} aria-invalid={!!state.fieldErrors?.nickname} aria-describedby={state.fieldErrors?.nickname ? "nickname-error" : "nickname-help"} />
    <p id="nickname-help" className="text-xs text-muted-foreground">2–20 characters: letters, numbers, spaces, hyphens, underscores.</p>
    {state.fieldErrors?.nickname?.map(message => <p id="nickname-error" key={message} role="alert" className="text-sm text-red-600">{message}</p>)}
    {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    {state.message && <p role="status" className="text-sm">{state.message}</p>}
    <ActionSubmit idle="Save score" pending="Saving…" />
  </form>;
}
```

### `components/add-puzzle-form.tsx`

Admin add-puzzle form. Labels, field errors, native controls and pending button support keyboard and screen-reader use.

```tsx
"use client";
import { useActionState } from "react";
import { addPuzzle } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/game";
import { ActionSubmit } from "@/components/action-submit";
import { Input } from "@/components/ui/input";

export function AddPuzzleForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(addPuzzle, {});
  const value = (name: string) => state.values?.[name] ?? "";
  return <form action={formAction} className="space-y-4 rounded-xl border p-5">
    <h2 className="text-lg font-bold">Add puzzle</h2>
    <div><label htmlFor="word" className="mb-1 block text-sm font-medium">Word</label><Input key={value("word")} id="word" name="word" defaultValue={value("word")} maxLength={5} aria-describedby="word-error" aria-invalid={!!state.fieldErrors?.word}/>{state.fieldErrors?.word?.map(e => <p id="word-error" key={e} role="alert" className="text-sm text-red-600">{e}</p>)}</div>
    <div><label htmlFor="difficulty" className="mb-1 block text-sm font-medium">Difficulty</label><select key={value("difficulty") || "medium"} id="difficulty" name="difficulty" defaultValue={value("difficulty") || "medium"} className="h-10 w-full rounded-md border bg-background px-3"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>{state.fieldErrors?.difficulty?.map(e => <p key={e} role="alert" className="text-sm text-red-600">{e}</p>)}</div>
    <div><label htmlFor="hint" className="mb-1 block text-sm font-medium">Hint (optional)</label><Input key={value("hint")} id="hint" name="hint" defaultValue={value("hint")} maxLength={140} aria-describedby="hint-error"/>{state.fieldErrors?.hint?.map(e => <p id="hint-error" key={e} role="alert" className="text-sm text-red-600">{e}</p>)}</div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked/> Publish now</label>
    {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    <ActionSubmit idle="Add puzzle" pending="Saving…" />
  </form>;
}
```

### `app/page.tsx`

The home page lists only published puzzle numbers and difficulty. Each Play form creates a game through a Server Action rather than opening a client-only game state.

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
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">A little word challenge</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Guess the secret word</h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Find the hidden five-letter word in six tries. Every guess gives you clues.
        </p>
      </section>

      <Card className="mx-auto max-w-xl">
        <CardHeader><CardTitle>How to play</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm sm:text-base">
          <p>Enter a five-letter word. The tiles show how close your guess was.</p>
          <div className="flex items-center gap-3"><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded border-2 border-green-700 bg-green-600 font-bold text-white">A</span><span><strong>Correct</strong> — the letter is in the right position.</span></div>
          <div className="flex items-center gap-3"><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded border-2 border-yellow-500 bg-yellow-300 font-bold text-slate-950">B</span><span><strong>Present</strong> — the letter is in the word, but elsewhere.</span></div>
          <div className="flex items-center gap-3"><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded border-2 border-slate-500 bg-slate-500 font-bold text-white">C</span><span><strong>Absent</strong> — the letter isn’t available in the answer.</span></div>
          <p className="text-muted-foreground">Repeated letters count only as many times as they appear in the answer.</p>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold">Choose a puzzle</h2>
          <span className="text-sm text-muted-foreground">{puzzleList.length} available</span>
        </div>
        {puzzleList.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {puzzleList.map(({ id, difficulty }) => (
              <div key={id} className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="font-semibold">Puzzle #{id}</p><p className="mb-3 text-xs capitalize text-muted-foreground">{difficulty}</p>
                <form action={startGame}><input type="hidden" name="puzzleId" value={id}/><button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Play</button></form>
                <Link href={`/puzzle/${id}`} className="mt-2 block text-xs underline">Leaderboard</Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No puzzles found. Run <code>npm run db:seed</code> to load the puzzles.
          </p>
        )}
      </section>
      <p className="text-center text-sm"><Link href="/hall-of-fame" className="underline">Hall of Fame</Link> · <Link href="/admin" className="underline">Admin area</Link></p>
    </div>
  );
}
```

### `app/puzzle/[id]/page.tsx`

Shows a published puzzle and its top-ten leaderboard. An unpublished puzzle is treated as not found.

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPuzzle } from "@/db/queries";
import { getPuzzleLeaderboard } from "@/db/queries";
import { puzzleIdSchema } from "@/lib/validation";
import { startGame } from "@/app/actions/game";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export default async function PuzzlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = puzzleIdSchema.safeParse(id);
  if (!parsed.success) notFound();
  const puzzle = await getPublishedPuzzle(parsed.data);
  if (!puzzle) notFound();
  const leaderboard = await getPuzzleLeaderboard(puzzle.id);
  return <section className="mx-auto max-w-xl space-y-6">
    <div className="space-y-2 text-center"><Link href="/" className="text-sm text-muted-foreground underline">← All puzzles</Link><h1 className="text-3xl font-black">Puzzle #{puzzle.id}</h1><p className="text-sm capitalize text-muted-foreground">Difficulty: {puzzle.difficulty}</p>{puzzle.hint && <p className="text-sm">Hint: {puzzle.hint}</p>}
      <form action={startGame}><input type="hidden" name="puzzleId" value={puzzle.id}/><Button type="submit">Play</Button></form>
    </div>
    <div className="space-y-3"><h2 className="text-xl font-bold">Top 10 winners</h2>{leaderboard.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Nickname</th><th className="p-2">Attempts</th><th className="p-2">Date</th></tr></thead><tbody>{leaderboard.map((row,i)=><tr key={`${row.nickname}-${row.createdAt.toISOString()}-${i}`} className="border-b"><td className="p-2">{row.nickname}</td><td className="p-2">{row.attempts}</td><td className="p-2">{row.createdAt.toLocaleDateString()}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">No winning scores yet.</p>}</div>
  </section>;
}
```

### `app/game/[id]/page.tsx`

Loads the saved game on the server and renders its persisted guesses. The secret answer is not passed as a prop or included in the rendered output while playing; it is rendered only after a loss.

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GuessForm } from "@/components/guess-form";
import { SaveScoreForm } from "@/components/save-score-form";
import { getDb } from "@/db";
import { games, puzzles } from "@/db/schema";
import { gameIdSchema } from "@/lib/validation";
import type { LetterResult } from "@/lib/wordle";

export const dynamic = "force-dynamic";
const tileStyles: Record<LetterResult, string> = { correct: "border-green-700 bg-green-600 text-white", present: "border-yellow-500 bg-yellow-300 text-slate-950", absent: "border-slate-500 bg-slate-500 text-white" };

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!gameIdSchema.safeParse(id).success) notFound();
  const db = getDb();
  const [game] = await db.select().from(games).where(eq(games.id, id)).limit(1);
  if (!game) notFound();
  const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.id, game.puzzleId)).limit(1);
  if (!puzzle) notFound();
  const answer = game.status === "lost" ? puzzle.answer : null;
  return <section className="mx-auto max-w-md space-y-6">
    <div className="space-y-2 text-center"><Link href={`/puzzle/${game.puzzleId}`} className="text-sm text-muted-foreground hover:text-foreground">← Puzzle #{game.puzzleId}</Link><h1 className="text-2xl font-black">Game</h1><p className="text-sm text-muted-foreground">Your progress is saved on the server.</p></div>
    <div className="space-y-2" aria-label="Six attempts, five letters each">
      {Array.from({ length: 6 }, (_, row) => { const attempt = game.guesses[row]; return <div key={row} className="grid grid-cols-5 gap-2" aria-label={`Attempt ${row + 1}`}>{Array.from({ length: 5 }, (_, col) => { const letter = attempt?.word[col] ?? ""; const result = attempt?.results[col]; return <div key={col} role="img" aria-label={result ? `${letter.toUpperCase()}: ${result}` : `Attempt ${row + 1}, letter ${col + 1}: empty`} className={`flex aspect-square items-center justify-center rounded-md border-2 text-2xl font-extrabold uppercase ${result ? tileStyles[result] : "border-border bg-card"}`}>{letter}</div>; })}</div>; })}
    </div>
    <p className="text-center text-sm text-muted-foreground">Attempts used: {game.guesses.length} / 6</p>
    {game.status === "playing" ? <GuessForm key={game.guesses.length} gameId={game.id} disabled={game.status !== "playing"}/> : <Card><CardHeader><CardTitle>{game.status === "won" ? "Congratulations!" : "Game over"}</CardTitle></CardHeader><CardContent className="space-y-3">{game.status === "lost" && <p>The correct word was <strong className="tracking-widest">{answer?.toUpperCase()}</strong>.</p>}{game.status === "won" && <p>You solved it in {game.guesses.length} {game.guesses.length === 1 ? "attempt" : "attempts"}.</p>}{game.status === "won" && <SaveScoreForm gameId={game.id}/>}<Link href={`/puzzle/${game.puzzleId}`} className="block text-sm underline">Puzzle leaderboard</Link></CardContent></Card>}
  </section>;
}
```

### `app/admin/page.tsx`

Lists all puzzles, including unpublished ones, with play/win counts and publish controls. The page is deliberately unprotected as specified by the assignment.

```tsx
import { togglePublished } from "@/app/actions/admin";
import { AddPuzzleForm } from "@/components/add-puzzle-form";
import { ActionSubmit } from "@/components/action-submit";
import { getAdminPuzzles } from "@/db/queries";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const rows = await getAdminPuzzles();
  return <section className="space-y-8"><div><h1 className="text-3xl font-black">Admin area</h1><p className="mt-2 text-sm text-amber-700">Temporary coursework area: this page is not protected by login.</p></div>
    <AddPuzzleForm/>
    <div className="space-y-3"><h2 className="text-xl font-bold">All puzzles</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">#</th><th className="p-2">Word</th><th className="p-2">Difficulty</th><th className="p-2">Status</th><th className="p-2">Played / won</th><th className="p-2">Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-b"><td className="p-2">{row.id}</td><td className="p-2 font-mono uppercase">{row.answer}</td><td className="p-2 capitalize">{row.difficulty}</td><td className="p-2">{row.published ? "Published" : "Unpublished"}</td><td className="p-2">{row.played} / {row.won}</td><td className="p-2"><form action={togglePublished}><input type="hidden" name="puzzleId" value={row.id}/><ActionSubmit idle={row.published ? "Unpublish" : "Publish"} pending="Updating…" /></form></td></tr>)}</tbody></table></div></div>
  </section>;
}
```

### `app/hall-of-fame/page.tsx`

Groups saved winning scores by nickname and ranks the ten most successful nicknames.

```tsx
import Link from "next/link";
import { getHallOfFame } from "@/db/queries";
export const dynamic = "force-dynamic";
export default async function HallOfFamePage() {
  const rows = await getHallOfFame();
  return <section className="mx-auto max-w-xl space-y-5"><Link href="/" className="text-sm underline">← All puzzles</Link><h1 className="text-3xl font-black">Hall of Fame</h1><p className="text-sm text-muted-foreground">Top 10 nicknames by total puzzles won.</p>{rows.length ? <table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">#</th><th className="p-2">Nickname</th><th className="p-2">Puzzles won</th></tr></thead><tbody>{rows.map((row,i)=><tr key={row.nickname} className="border-b"><td className="p-2">{i+1}</td><td className="p-2">{row.nickname}</td><td className="p-2">{row.wins}</td></tr>)}</tbody></table> : <p>No winners yet.</p>}</section>;
}
```

### `drizzle/0001_server_games.sql`

Migration adds puzzle metadata and database constraints, then creates persistent games and score tables. Apply it with `npm run db:migrate`.

```sql
ALTER TABLE "puzzles" ADD COLUMN "difficulty" varchar(10) NOT NULL DEFAULT 'medium';
ALTER TABLE "puzzles" ADD COLUMN "hint" varchar(140);
ALTER TABLE "puzzles" ADD COLUMN "published" integer NOT NULL DEFAULT 1;
ALTER TABLE "puzzles" ADD COLUMN "created_at" timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_answer_unique" UNIQUE ("answer");

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

### `.env.example`

Documents the required database connection variable without committing a real password.

```bash
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/word_game
```

### `README.md`

Documents setup, migrations, seed, routes, tests and the temporary lack of admin authentication.

```markdown
# Word Game — Homework 2

A Wordle-style game built with Next.js App Router, TypeScript, PostgreSQL, Drizzle ORM, Zod, Tailwind CSS and shadcn/ui-style components.

## How to run the game

Requirements: Node.js 20.9+, npm and PostgreSQL.

1. Create a PostgreSQL database named `word_game`.
2. Copy `.env.example` to `.env` and set your real `DATABASE_URL`. Never commit `.env`.
3. Install packages: `npm install`
4. Apply both migrations: `npm run db:migrate`. The second migration adds game history, score saving, puzzle metadata and the database uniqueness rule.
5. Seed the original puzzles: `npm run db:seed`.
6. Start Next.js: `npm run dev`.
7. Open <http://localhost:3000>. The admin area is <http://localhost:3000/admin>; it is intentionally **not protected by authentication** for this homework and must not be deployed publicly as-is.

## Useful commands

```bash
npm run dev
npm run lint
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run test:wordle
```

## Routes

- `/` — published puzzle list and Play forms
- `/puzzle/[id]` — puzzle details and top 10 leaderboard
- `/game/[uuid]` — a persistent game address
- `/hall-of-fame` — top 10 nicknames by wins
- `/admin` — add, publish and unpublish puzzles (unprotected, temporary)

## Security and implementation notes

- Puzzle answers are not passed to the browser while a game is in progress. The game page loads guesses and status; the answer is rendered only after a loss. A win already reveals the answer through the successful guess.
- Every Server Action validates submitted data. Browser validation is only a convenience.
- A database transaction locks the game row before adding a guess, so simultaneous requests serialize. The database unique constraint on `scores.game_id` prevents duplicate score rows.
- The `puzzles.answer` unique constraint prevents duplicate words even if two admin submissions race.
- Nicknames are display names, not accounts. Duplicate nicknames are allowed.
- Guess validation checks five English letters, not whether the guess exists in a dictionary.
- For this homework, admin access is not authenticated. Add authentication and authorization before deploying.

## Homework 1 colour checks

Run `npm run test:wordle`. The `checkGuess` algorithm is unchanged.
```

## Existing files that remain part of the project

- `lib/wordle.ts` keeps the Homework 1 `checkGuess` algorithm and repeated-letter handling unchanged.
- `db/index.ts` keeps the existing server-only PostgreSQL pool and Drizzle client.
- `db/seed.ts` seeds the original puzzle words; new puzzle metadata uses database defaults.
- `drizzle/0000_abnormal_surge.sql` remains the original Homework 1 migration. The new migration is applied after it.
- `components/ui/*`, `components/header.tsx`, `components/footer.tsx`, `app/layout.tsx`, `app/globals.css`, `drizzle.config.ts`, `package.json` and the lockfile are retained from the original project.
- The old `components/word-game.tsx` was removed because it kept guesses only in browser state and called the old action signature.

## How the main flow works

1. The puzzle list submits a `puzzleId` to `startGame`.
2. The server confirms that the puzzle exists and is published, inserts a `games` row, and redirects to `/game/<uuid>`.
3. The game page reads the saved guesses and status. Reloading or opening the same URL restores the board.
4. The guess form submits to `submitGuess`. The action validates the word, locks the game row with `SELECT ... FOR UPDATE`, refuses a finished game or seventh guess, calculates colours on the server, and updates the row in one transaction.
5. On a loss, the page can reveal the answer. While the game is running, the answer is not rendered or passed to a Client Component.
6. A win enables the nickname form. `saveScore` validates the nickname and only inserts a score for a won game. The unique index on `scores.game_id` blocks duplicate rows even if requests race.
7. The admin form validates puzzle fields and writes a puzzle. The database unique constraint on `puzzles.answer` blocks duplicate words even if two requests arrive together.

## Important implementation notes

- `published` is stored as integer `1`/`0`; public puzzle queries filter for `1`.
- The admin area is intentionally not authenticated. Do not deploy it publicly before adding authentication and authorization.
- `revalidatePath` is called after writes so server-rendered routes use fresh data.
- A row lock serializes simultaneous guess submissions for one game. The client pending state improves usability, but the database transaction is the real protection.
- The admin form assigns `MAX(id) + 1`; if multiple admins add different words concurrently, use a database sequence or retry on ID collision as further hardening.

## Database setup

```bash
npm install
# Create a PostgreSQL database named word_game and configure .env from .env.example
npm run db:migrate
npm run db:seed
npm run dev
```

## Reflection file

`HOMEWORK_2.md` is included as a template. Replace its prompts with your own 2–4 sentence answers after you test and understand the implementation.

## Before handing in

Run `npm run lint`, `npm run build`, and `npm run test:wordle`; then manually check the 17 assignment scenarios. Dependency installation timed out in this environment, so lint/build have not been verified here. Verify the migration on a fresh database, unique constraints, absence of the answer from in-progress network responses, and double-request behavior. Keep `.env` out of Git and commit at least eight meaningful incremental changes.


## Header navigation update

`components/header.tsx` now places the **Puzzle list**, **Hall of Fame**, and **Admin area** links together in the shared header. The navigation uses semantic `<nav>` markup with an accessible label, button-like link styles, and wrapping on narrow screens.

---

# Complete project file guide — the remaining files

The earlier sections explain the main database schema, queries, validation, Server Actions, forms, and pages. This section covers the rest of the files in the project so you can understand what every file contributes and how the pieces work together.

## 1. Game rules and validation

### `lib/wordle.ts` — the Wordle scoring algorithm

This file contains the pure function `checkGuess(answer, guess)`. A *pure function* calculates a result from its inputs without reading the database, changing global state, or making a network request. That makes it easy to test.

- `LetterResult` is a TypeScript union type: a result can only be `"correct"`, `"present"`, or `"absent"`.
- `normalizedAnswer` and `normalizedGuess` convert both strings to lowercase so letter comparisons are case-insensitive.
- `result` starts with five `"absent"` entries because every letter is absent unless a later check proves otherwise.
- `remaining` is a mutable copy of the answer's letters. When a letter is matched, its slot is replaced with an empty string so it cannot be matched a second time.
- The **first loop** marks exact matches (`guess[i] === answer[i]`) as `"correct"` and consumes those answer letters first.
- The **second loop** checks every position that is not already correct. `indexOf()` finds one remaining occurrence of that guessed letter. If found, the result becomes `"present"` and that occurrence is consumed.
- The function returns one result per letter, in the same order as the guess.

Consuming letters prevents duplicate-letter mistakes. For example, if the answer contains only one `a`, a guess containing three `a` characters must not mark all three as present/correct. The function assumes it receives five-letter strings; input validation belongs in `lib/validation.ts` and the Server Actions.

### `lib/validation.ts` — rules for untrusted form data

This file defines Zod schemas and inferred TypeScript types for values arriving from forms, such as puzzle words, difficulty, hints, puzzle IDs, and guesses. Browser-side checks help users, but they are not a security boundary: a request can be sent without using the UI. Server Actions therefore parse submitted values with these schemas before using them in database queries.

- A schema describes which values are allowed and what constraints they must satisfy.
- `safeParse()` returns a result object instead of throwing for ordinary validation failures. Check `.success` before reading `.data`.
- `z.infer<typeof someSchema>` derives a TypeScript type from a schema, avoiding a separately maintained duplicate type.
- Validation errors can be returned to a form as field errors so the user can correct a specific field.

### `scripts/test-wordle.ts` — automated tests for letter colours

This script imports `checkGuess` and Node's strict assertion helper. Each test case supplies an answer, a guess, and the expected five results. `assert.deepEqual()` fails the script if the actual array differs from the expected array. The cases cover a perfect guess and duplicate-letter situations. Run them with `npm run test:wordle`. These tests exercise the scoring algorithm only; they do not test the database, routes, or browser UI.

## 2. Database connection and setup

### `db/index.ts` — create and reuse the database connection

This is the central database connection module used by application queries.

- `import "server-only"` helps prevent this module from being imported into a Client Component, because database credentials and the PostgreSQL driver belong on the server.
- `Pool` from `pg` manages PostgreSQL connections rather than opening a brand-new connection for every query.
- `DATABASE_URL` is read from the environment. If it is missing, the module throws a helpful error instead of attempting a connection with an undefined URL.
- `globalForPool` stores the pool on `globalThis`. This helps reuse the pool during Next.js development reloads rather than creating a new pool for every reload.
- `getDb()` passes the pool and schema definitions to Drizzle and returns the database object used by `db/queries.ts` and the Server Actions.

The `globalThis` cast is a TypeScript technique to describe the custom `wordGamePool` property. It does not make the database available to the browser; `server-only` is the important server boundary.

### `db/seed.ts` — insert initial puzzles

A *seed* script inserts initial data so the app has puzzles to play after the database is created.

- `loadEnvConfig(process.cwd())` loads environment variables using Next.js environment-file rules when running the script outside the Next.js server.
- The script checks `DATABASE_URL` before connecting.
- `words` is a fixed list of five-letter answers.
- `words.map((answer, index) => ...)` turns each word into a row with an explicit ID (`index + 1`). This is why the puzzle IDs are predictable for the starter data.
- `onConflictDoNothing({ target: puzzles.id })` makes repeated seed runs safe for IDs that already exist. It does not overwrite an existing puzzle with the same ID.
- `try/finally` ensures `pool.end()` is called to close the connection even if insertion fails.
- The final `.catch()` prints an error and sets a non-zero process exit code when seeding fails.

Run it with `npm run db:seed`, after configuring the database and applying migrations. The script is for initial puzzle records; it is not the same thing as the admin form for adding a new puzzle.

### `drizzle.config.ts` — instructions for Drizzle Kit

Drizzle Kit is the command-line tool that generates and applies migrations. This configuration tells it:

- `dialect: "postgresql"`: the target database is PostgreSQL.
- `schema: "./db/schema.ts"`: the TypeScript file that describes the tables.
- `out: "./drizzle"`: where generated migration files and metadata are stored.
- `dbCredentials: { url }`: the database connection URL.

The environment is loaded and checked first so commands fail early with a clear message if `DATABASE_URL` is missing. This file configures Drizzle Kit; application runtime connections are created separately in `db/index.ts`.

### `drizzle/0000_abnormal_surge.sql` — initial migration

A migration is a versioned SQL change to the database. This first migration represents the original database structure for the project. Keep migration files under version control so a fresh database can be built consistently. Do not edit an already-applied migration casually; create a new migration when the schema changes, otherwise different environments may end up with different database structures.

### `drizzle/0001_server_games.sql` — migration for persistent games and scores

This migration contains SQL changes for the server-persisted game flow, including the game records, guesses/status information, and score records/constraints described by `db/schema.ts`. It lets the server remember a game between page requests instead of trusting the browser to hold the authoritative game state. Review the SQL itself if you need to know the exact database-level types, foreign keys, and indexes.

### `drizzle/meta/_journal.json` — migration history index

Drizzle Kit records migration metadata in this file, including the migration sequence. It helps the migration tool know which generated migrations belong to the project's history. It is generated metadata; normally you should not hand-edit it.

### `drizzle/meta/0000_snapshot.json` — schema snapshot

This JSON file is a machine-readable snapshot of the schema at a migration point. Drizzle Kit uses snapshots to compare schema versions when generating future migrations. It is not a file that application pages import at runtime, and it is not intended to be edited manually.

## 3. Shared layout and styling

### `app/layout.tsx` — root layout

The root layout wraps all route pages. It normally defines the HTML document structure (`html` and `body`), imports the global stylesheet, sets page metadata, and renders shared UI such as the header and footer around the current route's `children`.

Next.js App Router requires a root layout so all pages share the same outer document. `children` represents whichever page or nested layout matches the requested URL. Shared navigation is placed here through the header component, so the links remain available on the puzzle list, game, Hall of Fame, and admin pages.

### `app/globals.css` — global Tailwind and theme styles

This stylesheet is imported by the root layout. It contains the global CSS/Tailwind import and shared design tokens or base rules used throughout the app, such as background, foreground, border, and accent colours. Page-specific layout and most component styling are expressed through Tailwind utility classes in the `.tsx` files.

### `components/header.tsx` — shared navigation

The header displays the Word Game title and three navigation links: **Puzzle list** (`/`), **Hall of Fame** (`/hall-of-fame`), and **Admin area** (`/admin`). It uses Next.js `Link` so navigation is handled by the app router. The semantic `<nav aria-label="Main navigation">` gives assistive technology a clear label. Flex wrapping and gaps let the navigation adapt to narrower screens.

### `components/footer.tsx` — shared footer

The footer is a small reusable component rendered by the root layout. Keeping it separate avoids repeating the same footer markup on every page and makes future text or style changes a one-file change.

### `components/ui/button.tsx` — reusable button primitive

This is a small shared UI button component. It centralizes common button styling and behaviour so forms and pages use consistent buttons. A single component can expose props such as `type`, `disabled`, and styling variants. Keeping the primitive in `components/ui` distinguishes general UI building blocks from Word Game-specific components such as `GuessForm`.

### `components/ui/card.tsx` — reusable card primitives

This file provides reusable card pieces such as a card container, header, title, description, content, and footer. Pages can compose these pieces to create consistent panels without duplicating border, background, padding, and spacing classes. The named exports are used by pages such as the game and admin screens.

### `components/ui/input.tsx` — reusable input primitive

This file provides a shared styled input component. Forms use it for fields such as a five-letter guess, a nickname, or puzzle details. A common input component keeps sizing, border, focus, and disabled styles consistent across the app.

### `lib/utils.ts` — class-name helper

This utility contains the `cn()` helper, commonly used by shadcn-style components. It combines conditional class names (`clsx`) and merges Tailwind classes (`tailwind-merge`). For example, if a default class sets one padding value and a caller supplies another, the merge utility can resolve conflicting Tailwind classes rather than leaving both to compete.

### `components.json` — shadcn/ui generator configuration

This configuration tells the shadcn/ui CLI where the app's components and utilities live, which styling setup it uses, and which aliases to write into generated components. It is tooling configuration, not a page or runtime component. If you move the `components` or `lib` directories, update the aliases so generated imports still point to the right files.

## 4. Routes and route-specific error UI

### `app/page.tsx` — puzzle list route (`/`)

This Server Component loads published puzzle metadata using the query functions and renders the available puzzles. It should not select or send puzzle answers to the public list. Selecting a puzzle takes the user to its puzzle detail route, from which a new game can be started.

Because it is a Server Component by default, it can call server-side query functions directly. It does not need a `"use client"` directive unless it starts using client-only React state or browser APIs.

### `app/puzzle/[id]/page.tsx` — puzzle details (`/puzzle/:id`)

The `[id]` directory is a dynamic route segment: Next.js places the URL segment into the page's route parameters. The page validates/parses that ID, looks up the corresponding published puzzle metadata, and renders its details and a form/action to start a game. It should only expose safe public information such as the puzzle number, difficulty, and hint—not the answer.

### `app/puzzle/[id]/not-found.tsx` — puzzle-specific not-found UI

This component supplies a not-found message in the dynamic puzzle route when that puzzle cannot be found or is not available. Keeping it near the route lets the message be specific to a missing puzzle, while `app/not-found.tsx` is the app-wide fallback.

### `app/not-found.tsx` — global not-found UI

Next.js renders this page when a route cannot be resolved or code explicitly invokes the framework's not-found handling without a more specific boundary. It gives the user a friendly way to return to the puzzle list instead of seeing a technical error.

### `app/game/[id]/page.tsx` — persisted game route (`/game/:id`)

This dynamic route loads one saved game by its UUID, then uses its puzzle ID to retrieve the secret answer on the server for checking/rendering the completed state. While the game is still playing, the answer must not be passed to a Client Component or included in rendered client-facing data. The page shows the recorded guesses and their letter results, plus the form for submitting another guess.

When the game is finished, the page can show the answer and the score-saving form. The current version also asks `getNextPuzzleId(game.puzzleId)` after the game ends. If another published puzzle exists, it renders a form with a hidden `puzzleId` and a **Next puzzle #N** button. Submitting that form calls the `startGame` Server Action, which creates a new persisted game and redirects to the new game URL. If no higher published puzzle exists, the page instead offers a link back to the puzzle list. This chooses the next *published* puzzle with a greater ID; it does not simply assume that `current ID + 1` exists.

### `app/admin/page.tsx` — admin route (`/admin`)

This page shows puzzle-management information, such as each puzzle's answer, difficulty, hint, publication status, number of games played, and number of wins. It includes the puzzle creation form and a control for changing whether a puzzle is published. The page reads data on the server; changes are submitted to the Server Actions in `app/actions/admin.ts`.

### `app/hall-of-fame/page.tsx` — global leaderboard (`/hall-of-fame`)

This page queries the Hall of Fame data and displays players ranked by recorded wins. It is separate from the per-puzzle leaderboard, which ranks successful games for one puzzle by attempt count and completion time. Both leaderboards depend on score rows written by the score-saving Server Action, rather than trusting a client-supplied leaderboard total.

## 5. Client-side forms and reusable components

### `components/action-submit.tsx` — submit button with pending state

This component uses React's form status functionality to determine whether its parent form is currently submitting. It can disable the button and change its label while the action is pending, helping prevent accidental repeated submissions and giving users feedback. Because pending state is a client-side React feature, the component is a Client Component.

### `components/guess-form.tsx` — submit a guess

This Client Component collects the player's guess and submits it to the server action. It can use controlled or native form inputs and displays field-level validation feedback returned by the action. The server still performs authoritative validation; client-side constraints are for usability, not security. The pending button communicates that the request is being processed.

### `components/save-score-form.tsx` — save a winning score

This form collects the nickname for a completed winning game and submits it to the score-saving Server Action. It should only be offered when the game is won, and the server must independently verify that the game really is won before inserting a score. That prevents a user from manually sending a request to create a leaderboard entry for a loss or an unfinished game.

### `components/add-puzzle-form.tsx` — create a puzzle

This Client Component gathers the new puzzle's ID, five-letter answer, difficulty, and optional hint. It submits the values to the admin Server Action and can show validation errors next to the relevant fields. The Server Action repeats all important validation and handles database uniqueness conflicts because browser validation alone cannot guarantee valid or unique records.

## 6. Server Actions

### `app/actions/game.ts` — start games, submit guesses, and save scores

This file contains server-side functions that are called when forms are submitted. The `"use server"` directive marks exported functions as Server Actions. They parse and validate submitted `FormData`, query the database, apply the game rules, update the persisted game, and redirect or revalidate routes as appropriate.

The important security idea is that the server is authoritative: it loads the real answer from the database and calculates the guess result with `checkGuess()`. The browser does not send trusted colour results or decide whether the game is won. The action checks the game state so a finished game cannot continue accepting guesses. The score action verifies the game is won and avoids duplicate score rows for one game.

### `app/actions/admin.ts` — add puzzles and toggle publication

This file contains the admin mutations. `addPuzzle` validates the puzzle ID, answer, difficulty, and hint before inserting a record. `togglePublished` validates the puzzle ID and updates the publication flag. The validation guard should check the Zod results directly, for example `if (!word.success || !difficulty.success || !hint.success)`, before reading each result's `.data`; this allows TypeScript to narrow the result to the successful variant. The action also needs to handle duplicate IDs/answers gracefully rather than returning a raw database exception to the user.

**Important project limitation:** the `/admin` route is an admin interface, but unless a real authentication/authorization check has been added, it is not protected merely because it is named “Admin area.” For a public production app, verify the user's role on the server inside every admin Server Action and protect the page too.

## 7. Project documentation and environment files

### `README.md` — project introduction and run instructions

The README is the short entry point for another developer. It should describe the project, prerequisites, environment setup, database migration/seeding commands, how to run the development server, and the available routes. It is intentionally shorter than this file: use the README to get started and this guide to understand implementation details.

### `HOMEWORK_2.md` — homework submission/reflection

This file is the assignment-specific checklist/reflection. Fill in the prompts with your own explanation of the work, the problems you solved, and how you tested it. Do not submit placeholder reflections unchanged; make sure the answers truthfully describe your own work and testing.

### `.env.example` — environment variable template

This file shows the names of environment variables needed by the app without containing real credentials. Copy it to `.env` and set `DATABASE_URL` to your local PostgreSQL connection string. The actual `.env` should not be committed to Git because it may contain passwords or other secrets.

### `.gitignore` — files Git should ignore

This file lists generated files and local-only content that should not be tracked, such as dependencies, build output, environment secrets, and other machine-specific artifacts. Keep `.env` ignored and commit `.env.example` instead. If Git shows generated files or secrets as changes, check this file before committing.

### `.nvmrc` — Node.js version hint

This file specifies the Node.js version expected by the project/tooling. Version managers can read it to select a compatible Node release. The `engines` and framework requirements in `package.json` should also be checked if installation or build commands report a Node-version problem.

### `package.json` — dependencies and npm scripts

This is the project's main Node package manifest.

- `dependencies` are packages needed to run the app, including Next.js, React, Drizzle ORM, PostgreSQL's `pg` driver, Zod, and styling helpers.
- `devDependencies` are development tools such as TypeScript, ESLint, Drizzle Kit, and `tsx`.
- `dev` runs the development server (`npm run dev`).
- `build` creates the production build (`npm run build`).
- `start` runs a previously built production app.
- `lint` runs ESLint.
- `db:generate` generates a migration from schema changes.
- `db:migrate` applies migrations to the configured database.
- `db:seed` inserts the starter puzzle rows.
- `test:wordle` runs the scoring tests.

Use `npm run db:generate` after changing `db/schema.ts`, review the generated SQL, then apply the migration with `npm run db:migrate`. Do not assume a successful build proves the database is correctly configured: the build, database migration, seeding, and tests are separate checks.

### `package-lock.json` — exact dependency resolution

This lockfile records the resolved package versions and dependency tree used by npm. It helps different machines install a consistent dependency set. Usually update it through `npm install` when dependencies change; do not edit it manually. Commit it together with `package.json` so the project can be reproduced.

## 8. Framework and tooling configuration

### `next.config.ts` — Next.js configuration

This file exports the configuration object for Next.js. It is the place for framework-level settings such as build behaviour, image configuration, or other Next.js options. If it contains few options, that is normal: default Next.js behaviour is often sufficient.

### `next-env.d.ts` — generated Next.js TypeScript declarations

Next.js maintains this file so TypeScript understands framework-specific types. It is generated/managed by Next.js and generally should not be edited by hand.

### `tsconfig.json` — TypeScript compiler settings

This file controls how TypeScript checks the project: JavaScript/TypeScript target, module resolution, JSX support, strictness, path aliases, and which files are included. An alias such as `@/db` lets the project import from the root using a short path rather than long relative paths. If TypeScript cannot resolve an `@/` import, inspect `baseUrl`/`paths` here.

### `eslint.config.mjs` — lint rules

This file configures ESLint, including Next.js-recommended rules and the files those rules apply to. `npm run lint` reads this configuration. A lint error is a static-code-quality problem; it is different from a TypeScript build error or a runtime database error.

### `postcss.config.mjs` — CSS processing configuration

PostCSS runs transformations on CSS during the build. This configuration connects Tailwind CSS's PostCSS plugin to the build pipeline. If Tailwind classes stop compiling, this file and the Tailwind dependency versions are among the places to check.

## 9. How the files connect during a typical game

1. **Open the list:** `app/page.tsx` calls a read function from `db/queries.ts`.
2. **Read safe puzzle metadata:** `db/queries.ts` selects published puzzle IDs and difficulty without returning answers to the public list.
3. **Open a puzzle:** `app/puzzle/[id]/page.tsx` validates the route ID and reads the published puzzle's public metadata.
4. **Start a game:** the form calls `startGame` in `app/actions/game.ts`. The action validates the puzzle ID, checks that the puzzle is published, inserts a row in `games`, and redirects to `/game/<uuid>`.
5. **Make a guess:** `components/guess-form.tsx` sends form data to the guess Server Action. The server validates the guess, loads the game and answer, calls `checkGuess()` from `lib/wordle.ts`, then persists the guess and updated status.
6. **Show the result:** `app/game/[id]/page.tsx` reads the saved game and displays the recorded guesses. The answer must remain server-side while the game is still playing.
7. **Save a win:** after a win, `components/save-score-form.tsx` submits a nickname. The server verifies the win and stores a row in `scores`.
8. **Display rankings:** `app/hall-of-fame/page.tsx` and the per-puzzle game page use read queries from `db/queries.ts` to display scores.
9. **Continue to the next puzzle:** after the game ends, `getNextPuzzleId()` finds the next higher-ID published puzzle. The button submits its ID to `startGame`, which creates a new game rather than reusing the finished game.

## 10. Suggested order for learning the code

If you are learning the project for the first time, read the files in this order:

1. `lib/wordle.ts` — understand the game scoring algorithm.
2. `lib/validation.ts` — learn how incoming values are checked.
3. `db/schema.ts` — understand the tables and relationships.
4. `db/index.ts` and `drizzle.config.ts` — understand the connection and migration tooling.
5. `db/queries.ts` — see how the app reads data from PostgreSQL.
6. `app/actions/game.ts` — follow how a game is started, guessed, and scored.
7. `components/guess-form.tsx` and `components/save-score-form.tsx` — see how forms call server actions.
8. `app/page.tsx`, `app/puzzle/[id]/page.tsx`, and `app/game/[id]/page.tsx` — connect database and actions to routes.
9. `app/actions/admin.ts`, `components/add-puzzle-form.tsx`, and `app/admin/page.tsx` — understand puzzle administration.
10. `drizzle/*.sql` and `db/seed.ts` — understand how the database is created and populated.
11. Configuration files — learn them as needed when installing, building, linting, or changing styling.

## 11. Commands to check your local project

Run these from the `word-game` project directory in PowerShell:

```powershell
npm install
npm run db:migrate
npm run db:seed
npm run test:wordle
npm run lint
npm run build
npm run dev
```

Before running database commands, make sure PostgreSQL is running and `.env` contains a valid `DATABASE_URL`. If a command fails, fix the first reported error and run it again before moving to the next command. A passing `test:wordle` confirms the scoring examples; it does not by itself confirm the whole application or database is working.
