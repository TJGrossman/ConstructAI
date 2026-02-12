"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md space-y-4 p-6 text-center">
        <h2 className="text-2xl font-bold">Dashboard Error</h2>
        <p className="text-muted-foreground">
          {error.message || "Something went wrong in the dashboard."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-md border border-input px-6 py-3 text-sm font-medium hover:bg-accent"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
