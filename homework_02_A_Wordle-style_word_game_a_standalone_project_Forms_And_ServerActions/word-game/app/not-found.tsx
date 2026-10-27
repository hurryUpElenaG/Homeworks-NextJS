import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 py-12 text-center">
      <h1 className="text-3xl font-black">Page not found</h1>
      <p className="text-muted-foreground">
        That page doesn’t exist. You can return to the puzzle list.
      </p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90"
      >
        Back to puzzles
      </Link>
    </div>
  );
}
