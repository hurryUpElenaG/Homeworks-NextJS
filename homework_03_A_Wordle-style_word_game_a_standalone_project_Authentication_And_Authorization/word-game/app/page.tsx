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
