# Word Game — Code File by File with Explanations

This guide uses the actual source code from the supplied `word-game-homework1.zip`. Each section explains the purpose of a file and then includes its complete contents. Keep this guide open beside VS Code while studying.

> **Security:** `.env.example` is only a template. Put real database credentials in your local `.env` and never commit that file.

## Main application flow

1. `db/schema.ts` defines the `puzzles` table.
2. `drizzle.config.ts` tells Drizzle Kit where the schema and migration output are.
3. `db/index.ts` creates the application database connection.
4. `db/seed.ts` inserts the initial words.
5. `db/queries.ts` provides reusable database reads.
6. The Next.js pages load puzzle IDs and puzzle records.
7. `components/word-game.tsx` manages the interactive board in the browser.
8. `app/actions/game.ts` validates and scores each guess on the server.
9. `lib/wordle.ts` calculates the letter-by-letter result.

---

## `package.json` — Project scripts and dependencies

Defines the package name, dependencies, development tools, and npm scripts. `npm run dev` starts Next.js; `db:generate`, `db:migrate`, and `db:seed` manage the database; `test:wordle` runs the scoring tests.

````json
{
  "name": "word-game",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx db/seed.ts",
    "test:wordle": "tsx scripts/test-wordle.ts"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.2.3",
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
    "@next/env": "16.3.6"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.17",
    "@types/node": "^22.15.30",
    "@types/pg": "^8.15.5",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "eslint": "^9.39.1",
    "eslint-config-next": "16.3.6",
    "drizzle-kit": "0.31.5",
    "tailwindcss": "^4.1.17",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3"
  }
}
````

## `.env.example` — Environment variable template

Documents the required `DATABASE_URL`. Copy this file to `.env` and replace placeholder credentials with your actual PostgreSQL connection. Never commit a real `.env` file.

````dotenv
# Replace the placeholder with your local PostgreSQL credentials.
DATABASE_URL=postgres://postgres:postgres@localhost:5432/word_game
````

## `.gitignore` — Files Git should ignore

Keeps local secrets, installed packages, generated build output, and other machine-specific files out of version control.

````text
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
````

## `.nvmrc` — Expected Node version

Specifies the Node.js version expected by the project tooling.

````text
22
````

## `drizzle.config.ts` — Drizzle Kit configuration

`loadEnvConfig` loads environment variables; `process.cwd()` is the current working directory. The code checks `DATABASE_URL`, then configures PostgreSQL, the schema path, migration output directory, and database credentials. Drizzle Kit uses this file for migration commands.

````typescript
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not configured. Add it to .env first.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
````

## `db/schema.ts` — Database table definition

`pgTable` describes the PostgreSQL `puzzles` table. `id` is an integer primary key; `answer` is text limited to five characters and cannot be SQL `NULL`. `Puzzle` is inferred from the schema so the TypeScript row type follows the table definition.

````typescript
import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const puzzles = pgTable("puzzles", {
  id: integer("id").primaryKey(),
  answer: varchar("answer", { length: 5 }).notNull(),
});

export type Puzzle = typeof puzzles.$inferSelect;
````

## `db/index.ts` — Application database connection

`server-only` prevents this database module from being used in browser code. `Pool` manages reusable PostgreSQL connections. `getPool` checks the URL and caches a pool on `globalThis`; `getDb` returns a Drizzle instance configured with the pool and schema.

````typescript
import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForPool = globalThis as unknown as { wordGamePool?: Pool };

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Add it to .env first.");
  }

  if (!globalForPool.wordGamePool) {
    globalForPool.wordGamePool = new Pool({ connectionString });
  }
  return globalForPool.wordGamePool;
}

export function getDb() {
  return drizzle({ client: getPool(), schema });
}
````

## `db/queries.ts` — Reusable database queries

`getPuzzleNumbers` selects only IDs, so the home page does not retrieve answers. `getPuzzleById` selects one full puzzle and returns `null` if it does not exist. `getNextPuzzleId` looks for the next sequential ID. `asc` sorts ascending; `eq` builds an equals condition.

````typescript
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
````

## `db/seed.ts` — Initial puzzle data

Defines 30 words, maps them to IDs starting at 1, inserts them into PostgreSQL, and skips duplicate primary-key conflicts. `finally` closes the connection pool. The error handler prints failures and sets a nonzero exit code. `onConflictDoNothing` skips existing IDs; it does not update existing answers.

````typescript
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
  "apple", "brave", "crane", "drift", "eagle",
  "flame", "grape", "house", "input", "jelly",
  "knife", "lemon", "magic", "night", "ocean",
  "piano", "queen", "river", "stone", "tiger",
  "uncle", "video", "water", "young", "zebra",
  "bread", "chair", "dream", "earth", "field",
] as const;

async function seed() {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool });
  try {
    await db
      .insert(puzzles)
      .values(words.map((answer, index) => ({ id: index + 1, answer })))
      .onConflictDoNothing({ target: puzzles.id });
    process.stdout.write(`Seed complete: checked ${words.length} puzzle records.\n`);
  } finally {
    await pool.end();
  }
}

seed().catch((error: unknown) => {
  process.stderr.write(`Puzzle seeding failed: ${String(error)}\n`);
  process.exitCode = 1;
});
````

## `lib/validation.ts` — Runtime validation with Zod

`puzzleIdSchema` accepts route strings from 1 to 999, transforms the value into a number, and validates the result. `guessSchema` trims and requires exactly five English letters, then lowercases them. `attemptNumberSchema` accepts only integer attempts from 1 to 6. Runtime validation is needed because browser input is untrusted.

````typescript
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
````

## `lib/wordle.ts` — Wordle scoring algorithm

`LetterResult` restricts a tile result to `correct`, `present`, or `absent`. `checkGuess` normalizes case, initializes all results to absent, marks exact matches first, and consumes those answer letters. A second pass marks misplaced matches using only remaining letter occurrences, so repeated letters are scored correctly.

````typescript
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
````

## `lib/utils.ts` — CSS class utility

`cn` combines class names using `clsx` and resolves conflicting Tailwind utilities using `tailwind-merge`.

````typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
````

## `app/actions/game.ts` — Server Action that scores a guess

`use server` marks the exported function as a Server Action. `submitGuess` validates the attempt, puzzle ID, and guess; loads the answer on the server; calculates letter results; determines win/game-over state; and includes the answer only after the game ends. The current project does not persist attempts server-side.

````typescript
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
````

## `app/page.tsx` — Home page

This Server Component calls `getPuzzleNumbers`, explains the rules, and renders links to each puzzle. It retrieves only IDs. `dynamic = "force-dynamic"` makes the page render dynamically so it can reflect database content.

````tsx
import Link from "next/link";
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
            {puzzleList.map(({ id }) => (
              <Link
                key={id}
                href={`/puzzle/${id}`}
                className="rounded-xl border border-border bg-card p-4 text-center font-semibold transition hover:-translate-y-0.5 hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Puzzle #{id}
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No puzzles found. Run <code>npm run db:seed</code> to load the puzzles.
          </p>
        )}
      </section>
    </div>
  );
}
````

## `app/puzzle/[id]/page.tsx` — Dynamic puzzle page

The `[id]` folder defines a dynamic route. The page awaits route params, validates the ID, loads the puzzle and next puzzle ID, and calls `notFound()` for invalid or missing puzzles. It passes only IDs to the client game, not the secret answer.

````tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { WordGame } from "@/components/word-game";
import { getNextPuzzleId, getPuzzleById } from "@/db/queries";
import { puzzleIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PuzzlePage({ params }: PageProps) {
  const { id } = await params;
  const parsedId = puzzleIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const puzzle = await getPuzzleById(parsedId.data);
  if (!puzzle) notFound();

  const nextPuzzleId = await getNextPuzzleId(puzzle.id);

  return (
    <section className="space-y-7">
      <div className="space-y-2 text-center">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">← All puzzles</Link>
        <h1 className="text-2xl font-black sm:text-3xl">Puzzle #{puzzle.id}</h1>
        <p className="text-sm text-muted-foreground">Guess the five-letter word in six attempts.</p>
      </div>
      <WordGame key={puzzle.id} puzzleId={puzzle.id} nextPuzzleId={nextPuzzleId} />
    </section>
  );
}
````

## `components/word-game.tsx` — Interactive game board

`use client` enables React state and browser event handlers. The component tracks the current guess, previous attempts, errors, game status, revealed answer, and submission state. `handleSubmit` checks the input, calls the Server Action, stores results, and updates win/loss UI. The board is rendered as six rows of five tiles. The answer arrives only when the game ends.

````tsx
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { submitGuess } from "@/app/actions/game";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LetterResult } from "@/lib/wordle";

type Attempt = {
  word: string;
  results: LetterResult[];
};

type Props = {
  puzzleId: number;
  nextPuzzleId: number | null;
};

const tileStyles: Record<LetterResult, string> = {
  correct: "border-green-700 bg-green-600 text-white",
  present: "border-yellow-500 bg-yellow-300 text-slate-950",
  absent: "border-slate-500 bg-slate-500 text-white",
};

const resultLabels: Record<LetterResult, string> = {
  correct: "correct position",
  present: "present in another position",
  absent: "not present, or no copies remain",
};

export function WordGame({ puzzleId, nextPuzzleId }: Props) {
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "playing" || isSubmitting) return;

    const normalized = guess.trim().toLowerCase();
    if (!/^[a-z]{5}$/.test(normalized)) {
      setError("Enter exactly five letters (A–Z). No spaces, numbers, or symbols.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const response = await submitGuess(puzzleId, normalized, attempts.length + 1);
      if (response.error) {
        setError(response.error);
        return;
      }

      const updatedAttempts = [
        ...attempts,
        { word: normalized, results: response.results },
      ];
      setAttempts(updatedAttempts);
      setGuess("");

      if (response.won) {
        setStatus("won");
        setAnswer(response.answer ?? normalized);
      } else if (response.gameOver) {
        setStatus("lost");
        setAnswer(response.answer ?? "");
      }
    } catch {
      setError("Something went wrong while checking your guess. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="space-y-2" aria-label="Six attempts, five letters each">
        {Array.from({ length: 6 }, (_, rowIndex) => {
          const attempt = attempts[rowIndex];
          const isCurrentRow = rowIndex === attempts.length && status === "playing";

          return (
            <div key={rowIndex} className="grid grid-cols-5 gap-2" aria-label={`Attempt ${rowIndex + 1}`}>
              {Array.from({ length: 5 }, (_, colIndex) => {
                const letter = attempt?.word[colIndex] ?? (isCurrentRow ? guess[colIndex] ?? "" : "");
                const result = attempt?.results[colIndex];
                const style = result ? tileStyles[result] : "border-border bg-card";
                const label = result
                  ? `${letter.toUpperCase()}: ${resultLabels[result]}`
                  : `Attempt ${rowIndex + 1}, letter ${colIndex + 1}${letter ? `: ${letter}` : ": empty"}`;

                return (
                  <div
                    key={colIndex}
                    role="img"
                    aria-label={label}
                    className={`flex aspect-square items-center justify-center rounded-md border-2 text-2xl font-extrabold uppercase sm:text-3xl ${style}`}
                  >
                    {letter}
                    {result && <span className="sr-only">{resultLabels[result]}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Attempts used: {attempts.length} / 6
      </p>

      {status === "playing" && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="guess" className="block text-sm font-semibold">Your five-letter guess</label>
          <Input
            id="guess"
            value={guess}
            onChange={(event) => setGuess(event.target.value.toUpperCase())}
            maxLength={5}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="CRANE"
            aria-describedby={error ? "guess-error" : "guess-help"}
            disabled={isSubmitting}
            className="text-center text-lg font-bold uppercase tracking-[0.3em]"
          />
          <p id="guess-help" className="text-xs text-muted-foreground">Use letters A–Z. Press Enter to submit.</p>
          {error && <p id="guess-error" role="alert" className="text-sm font-medium text-red-600">{error}</p>}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Checking…" : "Submit guess"}
          </Button>
        </form>
      )}

      {status === "won" && (
        <div role="status" className="space-y-2 rounded-xl border border-green-300 bg-green-50 p-4 text-center text-green-950">
          <p className="text-lg font-bold">Congratulations!</p>
          <p>You found the word <strong>{answer.toUpperCase()}</strong> in {attempts.length} {attempts.length === 1 ? "attempt" : "attempts"}.</p>
        </div>
      )}

      {status === "lost" && (
        <div role="status" className="space-y-2 rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-lg font-bold">Game over</p>
          <p>The correct word was <strong className="tracking-widest">{answer.toUpperCase()}</strong>.</p>
        </div>
      )}

      {status !== "playing" && nextPuzzleId !== null && (
        <Button className="w-full" onClick={() => { window.location.href = `/puzzle/${nextPuzzleId}`; }}>
          Play puzzle #{nextPuzzleId}
        </Button>
      )}

      {status !== "playing" && nextPuzzleId === null && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">You have reached the last available puzzle.</p>
          <Link href="/" className="inline-flex min-h-10 items-center rounded-md border px-4 py-2 text-sm font-semibold transition hover:bg-accent">
            Back to puzzle list
          </Link>
        </div>
      )}
    </div>
  );
}
````

## `app/layout.tsx` — Root layout

Defines shared HTML/body structure, metadata, global CSS, and common header/footer around the current page. `children` is the page content selected by Next.js routing.

````tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Word Game — Five Letters",
  description: "A Wordle-style game. Guess the five-letter word in six attempts.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
````

## `components/header.tsx` — Reusable header

Contains the shared game header/title and navigation. A separate component avoids duplicating the same markup across pages.

````tsx
import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-border bg-card/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-black tracking-tight">
          WORD GAME<span className="text-primary">.</span>
        </Link>
        <Link href="/" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
          Puzzle list
        </Link>
      </div>
    </header>
  );
}
````

## `components/footer.tsx` — Reusable footer

Contains shared footer content rendered by the root layout.

````tsx
export function Footer() {
  return (
    <footer className="mt-12 border-t border-border py-6 text-center text-sm text-muted-foreground">
      Six guesses. Five letters. Good luck!
    </footer>
  );
}
````

## `app/not-found.tsx` — General not-found UI

Next.js renders this page when a route or resource cannot be found and no more specific not-found page is used.

````tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 py-12 text-center">
      <h1 className="text-3xl font-black">Page not found</h1>
      <p className="text-muted-foreground">That page doesn’t exist. You can return to the puzzle list.</p>
      <Link href="/" className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Back to puzzles</Link>
    </div>
  );
}
````

## `app/puzzle/[id]/not-found.tsx` — Puzzle-specific not-found UI

Displays a message for a missing puzzle and offers navigation back to the puzzle list.

````tsx
import Link from "next/link";

export default function PuzzleNotFound() {
  return (
    <div className="space-y-4 py-12 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">404 · Not found</p>
      <h1 className="text-3xl font-black">Puzzle not found</h1>
      <p className="mx-auto max-w-md text-muted-foreground">
        We couldn’t find that puzzle. The number may be invalid, or the puzzle may not exist.
      </p>
      <Link href="/" className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
        Back to puzzle list
      </Link>
    </div>
  );
}
````

## `components/ui/button.tsx` — Reusable button

Provides consistent button styling and variants. Class Variance Authority builds variant classes; Radix Slot support can let the component render styles on a child element when configured to do so.

````tsx
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
};

export function Button({ className, variant = "default", ...props }: ButtonProps) {
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
````

## `components/ui/card.tsx` — Reusable card building blocks

Exports card pieces such as container, header, title, and content. Pages compose these components to keep spacing and appearance consistent.

````tsx
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}
````

## `components/ui/input.tsx` — Reusable input

Wraps the native input with shared styles and standard input props. The game component controls its value with React state and updates it through `onChange`.

````tsx
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
````

## `app/globals.css` — Global CSS and theme

Imports Tailwind CSS and defines global styles/theme variables shared by the app. Most component styling uses Tailwind utility classes.

````css
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

* { box-sizing: border-box; }
html { min-height: 100%; }
body { min-height: 100vh; }
button, input { font: inherit; }
::selection { background: #d9e8df; }
````

## `scripts/test-wordle.ts` — Automated scoring tests

Uses Node assertions to compare `checkGuess` results with expected arrays. `deepStrictEqual` checks array contents and order. The scoring logic can be tested without running the UI or connecting to PostgreSQL.

````typescript
import assert from "node:assert/strict";
import { checkGuess, type LetterResult } from "../lib/wordle";

const cases: Array<{
  answer: string;
  guess: string;
  expected: LetterResult[];
}> = [
  { answer: "crane", guess: "crane", expected: ["correct", "correct", "correct", "correct", "correct"] },
  { answer: "alloy", guess: "llama", expected: ["present", "correct", "present", "absent", "absent"] },
  { answer: "speed", guess: "erase", expected: ["present", "absent", "absent", "present", "present"] },
  { answer: "apple", guess: "eagle", expected: ["absent", "present", "absent", "correct", "correct"] },
];

for (const testCase of cases) {
  assert.deepEqual(checkGuess(testCase.answer, testCase.guess), testCase.expected);
  process.stdout.write(`PASS ${testCase.answer} / ${testCase.guess}\n`);
}
process.stdout.write("All Wordle colour tests passed.\n");
````

## `tsconfig.json` — TypeScript configuration

Controls TypeScript checking, module resolution, JSX, and import aliases such as `@/*`. The alias makes imports shorter, for example `@/db/queries`.

````json
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
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", ".next/types/**/*.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
````

## `next.config.ts` — Next.js configuration

Contains framework-level Next.js settings. The project needs little custom framework configuration.

````typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};
export default nextConfig;
````

## `postcss.config.mjs` — CSS processing configuration

Configures PostCSS and the Tailwind CSS plugin used to process the project styles.

````javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
````

## `eslint.config.mjs` — Lint configuration

Configures ESLint with Next.js rules. `npm run lint` uses this configuration to identify common code problems.

````javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "drizzle/**"]),
]);
export default eslintConfig;
````

## `components.json` — UI tooling configuration

Stores conventions for the shadcn-style UI component setup, such as aliases and component locations. It is configuration, not rendered UI.

````json
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
````

## `README.md` — Project documentation

Contains the project overview, requirements, setup instructions, and available commands.

````markdown
# Word Game

A standalone Wordle-style five-letter word game built with Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui-style reusable components, Zod, Drizzle ORM, and PostgreSQL.

## Requirements

- Node.js 20.9 or newer (use a current supported Node.js LTS release)
- PostgreSQL 15 or newer recommended
- npm

## How to run the game

1. Clone this repository and open the `word-game` folder in VS Code.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a PostgreSQL database named `word_game`:

   ```sql
   CREATE DATABASE word_game;
   ```

4. Copy `.env.example` to `.env` and update `DATABASE_URL` with your local PostgreSQL username and password. Never commit `.env`.
5. Generate the Drizzle migration from the schema:

   ```bash
   npm run db:generate
   ```

6. Apply the migration:

   ```bash
   npm run db:migrate
   ```

7. Insert the 30 puzzles. The seed is safe to run repeatedly and will not insert duplicate puzzle IDs:

   ```bash
   npm run db:seed
   ```

8. Start the development server:

   ```bash
   npm run dev
   ```

9. Visit <http://localhost:3000>.

## Useful commands

```bash
npm run dev          # Start Next.js development server
npm run lint         # Run ESLint
npm run build        # Type-check and build the app
npm run test:wordle  # Test the four required colour examples
npm run db:generate  # Generate SQL migrations
npm run db:migrate   # Apply SQL migrations
npm run db:seed      # Seed puzzle data
```

## Routes

- `/` — rules and list of puzzles (only IDs are queried for this page)
- `/puzzle/1` — play puzzle 1
- `/puzzle/7` — play puzzle 7
- Invalid or missing puzzle IDs show a friendly not-found page.

## Letter-colour test cases

| Answer | Guess | Expected result |
|---|---|---|
| `crane` | `crane` | correct, correct, correct, correct, correct |
| `alloy` | `llama` | present, correct, present, absent, absent |
| `speed` | `erase` | present, absent, absent, present, present |
| `apple` | `eagle` | absent, present, absent, correct, correct |

Run `npm run test:wordle` to check these cases automatically. The algorithm first consumes exact-position matches, then consumes each remaining matching letter at most once. This is important for repeated letters.

## Design notes and current limitations

- PostgreSQL stores puzzle numbers and secret words. Drizzle defines the schema and applies migrations.
- The puzzle list selects only puzzle IDs, and the page passes only the puzzle ID to the interactive client component. The server action returns the answer only after a win or the sixth guess.
- React state holds the current game progress, so reloading the page resets that game. Persistence is an optional stretch goal.
- Guess validation checks the format (five English letters), not whether the guess is in a full dictionary.
- The attempt number is sent from the browser, so this is a coursework game, not a tamper-proof competitive game. A production version would persist attempts and game status server-side and validate them transactionally.
````

## `HOMEWORK_1.md` — Coursework reflection prompts

Contains homework questions for you to answer based on your own implementation and testing.

````markdown
# Homework 1 — Reflection

> Replace the prompts below with your own answers. Write 2–4 sentences for each question, based on what you implemented and tested.

## 1. Which parts run on the server and which run in the browser?

Write 2–4 sentences about the Server Components, database code, Server Action, and the client-side game board. Explain why the database connection should stay on the server.

## 2. Can you find the answer in developer tools?

Inspect the page source and the Network tab before and after the game ends. Explain when the answer is returned to the browser and what you would change for a production game.

## 3. Where are the puzzles stored, and why?

Explain how PostgreSQL, the Drizzle schema, migrations, and the seed work together. Compare this with hardcoding the puzzle words in a TypeScript array.

## 4. What happens for a missing puzzle?

Test `/puzzle/abc`, `/puzzle/0`, and a valid-looking number that is not in the database. Explain how Zod validation, the database query, and `notFound()` work together.

## 5. What was the hardest part?

Describe the hardest part for you personally, how you tested it, and what you would do differently if you started again.
````

## Run the project

Run these commands from the folder containing `package.json`:

```bash
npm install
```

Create a PostgreSQL database named `word_game`. Copy `.env.example` to `.env` and replace the example credentials with your actual PostgreSQL username and password.

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Then open `http://localhost:3000`.

Useful checks:

```bash
npm run test:wordle
npm run lint
npm run build
```

## Important concepts

- **Schema** describes the database structure. **Migrations** apply structural changes. **Seed data** inserts starting records.
- **Server Components** can fetch data on the server. The interactive game uses `"use client"` because it needs state and event handlers.
- **Server Actions** execute on the server, but their inputs still require validation.
- **Zod** validates runtime values; TypeScript types alone do not validate browser input.
- Repeated-letter scoring needs two passes: exact matches first, then misplaced matches using remaining answer-letter occurrences.
- In this homework version, attempts live in React state and are not persisted as a game session. Refreshing resets progress; a production version should keep authoritative attempt state on the server.
