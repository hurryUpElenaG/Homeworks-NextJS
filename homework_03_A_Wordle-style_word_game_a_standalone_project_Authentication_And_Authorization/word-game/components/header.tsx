import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

export async function Header() {
  const user = await getCurrentUser();

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
            className="text-muted-foreground hover:bg-accent rounded-md px-3 py-2 text-sm"
          >
            Puzzle list
          </Link>
          <Link
            href="/hall-of-fame"
            className="hover:bg-accent rounded-md px-3 py-2 text-sm"
          >
            Hall of Fame
          </Link>
          {user && (
            <Link
              href="/my-games"
              className="hover:bg-accent rounded-md px-3 py-2 text-sm"
            >
              My games
            </Link>
          )}
          {user?.role === "admin" && (
            <>
              <Link
                href="/admin"
                className="hover:bg-accent rounded-md px-3 py-2 text-sm"
              >
                Admin
              </Link>
              <Link
                href="/users"
                className="hover:bg-accent rounded-md px-3 py-2 text-sm"
              >
                Users
              </Link>
            </>
          )}
          {user ? (
            <>
              <span className="px-2 text-sm font-medium">{user.name}</span>
              <SignOutButton />
            </>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-md px-3 py-2 text-sm font-semibold underline"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
