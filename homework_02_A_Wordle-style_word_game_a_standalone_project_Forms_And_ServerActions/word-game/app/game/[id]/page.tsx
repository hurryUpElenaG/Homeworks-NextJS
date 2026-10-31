import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
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

export const dynamic = "force-dynamic";
const tileStyles: Record<LetterResult, string> = {
  correct: "border-green-700 bg-green-600 text-white",
  present: "border-yellow-500 bg-yellow-300 text-slate-950",
  absent: "border-slate-500 bg-slate-500 text-white",
};

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!gameIdSchema.safeParse(id).success) notFound();

  const db = getDb();

  const [game] = await db.select().from(games).where(eq(games.id, id)).limit(1);
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
        <GuessForm gameId={game.id} />
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
