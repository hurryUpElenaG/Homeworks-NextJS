"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { user } from "@/db/auth-schema";
import { requireAdmin } from "@/lib/session";

export async function toggleUserRole(formData: FormData) {
  const current = await requireAdmin("/users");
  const targetId = String(formData.get("userId") ?? "");

  if (!targetId || targetId === current.id) {
    redirect("/users");
  }

  const db = getDb();

  const result = await db.transaction(async (tx) => {
    // All role-changing requests take this same lock, one at a time.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(734921)`);

    const [target] = await tx
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1);

    if (!target || (target.role !== "admin" && target.role !== "player")) {
      return "not-found" as const;
    }

    if (target.role === "admin") {
      const admins = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.role, "admin"));

      if (admins.length <= 1) {
        return "last-admin" as const;
      }

      await tx
        .update(user)
        .set({ role: "player", updatedAt: new Date() })
        .where(eq(user.id, target.id));
    } else {
      await tx
        .update(user)
        .set({ role: "admin", updatedAt: new Date() })
        .where(eq(user.id, target.id));
    }

    return "updated" as const;
  });

  revalidatePath("/users");
  revalidatePath("/admin");

  if (result === "last-admin") {
    redirect("/users?error=last-admin");
  }
  if (result === "not-found") {
    redirect("/users?error=invalid-user");
  }

  redirect("/users");
}
