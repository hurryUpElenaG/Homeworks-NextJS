import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getMyGames, getMyGameStats } from "@/db/queries";
export const dynamic = "force-dynamic";

export default async function MyGamesPage() {
  await requireUser("/my-games");

  const [games, stats] = await Promise.all([getMyGames(), getMyGameStats()]);

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-black">My games</h1>
      <p className="text-muted-foreground">
        Played: {stats.played} · Won: {stats.won}
      </p>
      {games.length ? (
        <div className="space-y-3">
          {games.map((game) => (
            <article
              key={game.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
            >
              <div>
                <h2 className="font-bold">Puzzle #{game.puzzleId}</h2>
                <p className="text-muted-foreground text-sm capitalize">
                  {game.status} · {game.attempts} attempts ·{" "}
                  {game.createdAt.toLocaleString()}
                </p>
              </div>
              <Link href={`/game/${game.id}`} className="underline">
                {game.status === "playing" ? "Continue" : "View game"}
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <p>You have not played any games yet.</p>
      )}
    </section>
  );
}
