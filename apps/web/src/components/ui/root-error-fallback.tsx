'use client';

import { ErrorFallback } from '@/components/ui/error-fallback';

interface RootErrorFallbackProps {
  error: Error;
  reset: () => void;
}

export function RootErrorFallback({ error, reset }: RootErrorFallbackProps) {
  return (
    <ErrorFallback
      title="Application Error"
      description="Something unexpected happened in the app shell."
      error={error}
      onRetry={reset}
      className="m-4"
    />
  );
}