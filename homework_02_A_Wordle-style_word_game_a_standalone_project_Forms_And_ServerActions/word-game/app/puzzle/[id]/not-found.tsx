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
