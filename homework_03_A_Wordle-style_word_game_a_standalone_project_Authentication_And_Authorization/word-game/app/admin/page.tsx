import { togglePublished } from "@/app/actions/admin";
import { AddPuzzleForm } from "@/components/add-puzzle-form";
import { ActionSubmit } from "@/components/action-submit";
import { getAdminPuzzles } from "@/db/queries";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin("/admin");
  const rows = await getAdminPuzzles();

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-black">Admin area</h1>
        <p className="mt-2 text-sm text-amber-700">
          Manage puzzles and publication status.
        </p>
      </div>
      <AddPuzzleForm />
      <div className="space-y-3">
        <h2 className="text-xl font-bold">All puzzles</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">#</th>
                <th className="p-2">Word</th>
                <th className="p-2">Difficulty</th>
                <th className="p-2">Status</th>
                <th className="p-2">Played / won</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.id}</td>
                  <td className="p-2 font-mono uppercase">{row.answer}</td>
                  <td className="p-2 capitalize">{row.difficulty}</td>
                  <td className="p-2">
                    {row.published ? "Published" : "Unpublished"}
                  </td>
                  <td className="p-2">
                    {row.played} / {row.won}
                  </td>
                  <td className="p-2">
                    <form action={togglePublished}>
                      <input type="hidden" name="puzzleId" value={row.id} />
                      <ActionSubmit
                        idle={row.published ? "Unpublish" : "Publish"}
                        pending="Updating…"
                      />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
