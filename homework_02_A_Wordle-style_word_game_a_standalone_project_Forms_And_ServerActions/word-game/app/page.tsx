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
