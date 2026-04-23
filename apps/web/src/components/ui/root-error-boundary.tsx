'use client';

import { ErrorBoundary } from '@/components/ui/error-boundary';
import { ErrorFallback } from '@/components/ui/error-fallback';

interface RootErrorBoundaryProps {
  children: React.ReactNode;
}

export function RootErrorBoundary({ children }: RootErrorBoundaryProps) {
  return (
    <ErrorBoundary
      boundaryName="root-layout"
      fallback={({ error, reset }) => (
        <ErrorFallback
          title="Application Error"
          description="Something unexpected happened in the app shell."
          error={error}
          onRetry={reset}
          className="m-4"
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}