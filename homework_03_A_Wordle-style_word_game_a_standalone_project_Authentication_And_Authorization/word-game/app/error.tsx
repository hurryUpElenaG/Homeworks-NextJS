"use client";

import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Log the error for debugging/monitoring. Do not show database details to users.
    console.error(error);
  }, [error]);

  return (
     <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
    
          <p className="text-muted-foreground text-sm">
            We could not complete your request. The database may be temporarily
            unavailable. Please try again.
          </p>
    
          <Button type="button" onClick={() => retry()}>
            Try again
          </Button>
        </main>
  );
}
