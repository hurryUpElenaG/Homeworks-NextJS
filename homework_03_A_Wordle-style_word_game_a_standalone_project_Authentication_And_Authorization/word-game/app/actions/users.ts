"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { user } from "@/db/auth-schema";
import { requireAdmin } from "@/lib/session";

export async function toggleUserRole(formData: FormData) {
  const current = await requireAdmin("/users");
  const targetId = String(formData.get("userId") ?? "");

  if (!targetId || targetId === current.id) redirect("/users");

  const db = getDb();
  const [target] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, targetId))
    .limit(1);

  if (!target || (target.role !== "admin" && target.role !== "player"))
    redirect("/users");

  await db
    .update(user)
    .set({
      role: target.role === "admin" ? "player" : "admin",
      updatedAt: new Date(),
    })
    .where(eq(user.id, targetId));

  revalidatePath("/users");
  revalidatePath("/admin");
  redirect("/users");
}
