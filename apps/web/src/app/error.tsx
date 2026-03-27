"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  const isEnvError = error.message.includes("Environment variable validation failed");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-red-600">
            {isEnvError ? "⚙️ Configuration Error" : "Something went wrong"}
          </h1>
        </div>

        <div className="mb-6">
          {isEnvError ? (
            <div>
              <p className="mb-4 text-gray-700">
                The application is missing required environment variables.
              </p>
              <pre className="overflow-x-auto rounded bg-gray-100 p-4 text-sm text-gray-800">
                {error.message}
              </pre>
              <div className="mt-4 rounded-lg bg-blue-50 p-4">
                <h3 className="mb-2 font-semibold text-blue-900">How to fix:</h3>
                <ol className="list-inside list-decimal space-y-1 text-sm text-blue-800">
                  <li>Copy <code className="rounded bg-blue-100 px-1">.env.example</code> to <code className="rounded bg-blue-100 px-1">.env.local</code></li>
                  <li>Fill in all required environment variables</li>
                  <li>Restart the development server</li>
                </ol>
              </div>
            </div>
          ) : (
            <p className="text-gray-700">{error.message}</p>
          )}
        </div>

        <button
          onClick={reset}
          className="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
