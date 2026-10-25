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
