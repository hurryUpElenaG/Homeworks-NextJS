import Link from "next/link";
import { getHallOfFame } from "@/db/queries";
export const dynamic = "force-dynamic";

export default async function HallOfFamePage() {

    const rows = await getHallOfFame();
    
  return (
    <section className="mx-auto max-w-xl space-y-5">
      <Link href="/" className="text-sm underline">
        ← All puzzles
      </Link>
      <h1 className="text-3xl font-black">Hall of Fame</h1>
      <p className="text-muted-foreground text-sm">
        Top 10 nicknames by total puzzles won.
      </p>
      {rows.length ? (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">#</th>
              <th className="p-2">Nickname</th>
              <th className="p-2">Puzzles won</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.nickname} className="border-b">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">{row.nickname}</td>
                <td className="p-2">{row.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
      <p>No winners yet.</p>
      )}
    </section>
  );
}
