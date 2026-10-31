"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function EventsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {

  useEffect(() => {
    // Log the technical error for development/monitoring.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>

      <p className="text-muted-foreground text-sm">
        We could not complete your request. The database may be temporarily
        unavailable. Please try again.
      </p>

      {/* <p className="mt-1 line-clamp-3 font-mono text-xs break-all text-red-800">
        {error.message}
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-red-700">Error ID: {error.digest}</p>
      )} */}

      <Button type="button" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
