import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/db/auth";

export async function getCurrentUser() {
  const result = await auth.api.getSession({ headers: await headers() });
  return result?.user ?? null;
}

export async function requireUser(returnTo = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);

  return user;
}

export async function requireAdmin(returnTo = "/admin") {
  const user = await requireUser(returnTo);
  if (user.role !== "admin") redirect("/not-allowed");
  
  return user;
}

export async function requirePlayer(returnTo: string) {
  return requireUser(returnTo);
}
