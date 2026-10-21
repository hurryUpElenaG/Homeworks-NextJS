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
        <Link
          href={`/puzzle/${nextPuzzleId}`}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Play puzzle #{nextPuzzleId}
        </Link>
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
