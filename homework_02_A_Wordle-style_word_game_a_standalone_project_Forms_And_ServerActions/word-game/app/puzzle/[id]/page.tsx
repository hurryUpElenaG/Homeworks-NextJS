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
                  <th className="p-2">Nickname</th>
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
