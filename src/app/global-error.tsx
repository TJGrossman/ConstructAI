"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <div className="mx-auto max-w-md space-y-4 p-6 text-center">
            <h2 className="text-2xl font-bold">Something went wrong!</h2>
            <p className="text-gray-600">
              {error.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={reset}
              className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
