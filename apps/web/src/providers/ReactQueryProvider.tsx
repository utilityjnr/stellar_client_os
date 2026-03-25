"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { isRetryable } from "@/utils/retry";

export default function ReactQueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
                retry: (failureCount: number, error: unknown) => failureCount < 3 && isRetryable(error),
                retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
            },
            mutations: {
                retry: false,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
