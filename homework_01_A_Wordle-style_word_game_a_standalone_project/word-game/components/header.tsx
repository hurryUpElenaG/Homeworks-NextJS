import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-border bg-card/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-black tracking-tight">
          WORD GAME<span className="text-primary">.</span>
        </Link>
        <Link href="/" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
          Puzzle list
        </Link>
      </div>
    </header>
  );
}
