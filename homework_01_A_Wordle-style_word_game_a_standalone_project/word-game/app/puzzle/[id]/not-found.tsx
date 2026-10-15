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
