import Link from "next/link";

export function Header() {
  return (
    <header className="border-border bg-card/80 border-b">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="text-xl font-black tracking-tight">
          WORD GAME<span className="text-primary">.</span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="flex flex-wrap items-center gap-2"
        >
          <Link
            href="/"
            className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition"
          >
            Puzzle list
          </Link>

          <Link
            href="/hall-of-fame"
            className="hover:bg-accent hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition"
          >
            Hall of Fame
          </Link>

          <Link
            href="/admin"
            className="hover:bg-accent hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
