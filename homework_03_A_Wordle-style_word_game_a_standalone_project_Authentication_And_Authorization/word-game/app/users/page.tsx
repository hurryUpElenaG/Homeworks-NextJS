import { toggleUserRole } from "@/app/actions/users";
import { ActionSubmit } from "@/components/action-submit";
import { getUsers } from "@/db/queries";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const current = await requireAdmin("/users");
  const users = await getUsers();

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-black">Users</h1>
      <p className="text-muted-foreground text-sm">
        Promote players or demote other admins. You cannot change your own role.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-2">{item.name}</td>
                <td className="p-2">{item.email}</td>
                <td className="p-2">{item.role}</td>
                <td className="p-2">
                  {item.id === current.id ? (
                    "Your account"
                  ) : (
                    <form action={toggleUserRole}>
                      <input type="hidden" name="userId" value={item.id} />
                      <ActionSubmit
                        idle={
                          item.role === "admin" ? "Make player" : "Make admin"
                        }
                        pending="Updating…"
                      />
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
