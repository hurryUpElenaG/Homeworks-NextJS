"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function logout() {
    setPending(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" disabled={pending} onClick={logout}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
