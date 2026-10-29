import Link from "next/link";

export default function NotAllowedPage() {
  return (
    <section className="mx-auto max-w-lg space-y-4 text-center">
      <h1 className="text-3xl font-black">Not allowed</h1>
      <p className="text-muted-foreground">
        Your account does not have permission to open this page.
      </p>
      <Link href="/" className="underline">
        Back to the puzzle list
      </Link>
    </section>
  );
}
