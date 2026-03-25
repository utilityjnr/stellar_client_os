export interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
}

export class RetryableError extends Error {
    constructor(
        message: string,
        public readonly status?: number
    ) {
        super(message);
        this.name = "RetryableError";
    }
}

export function isRetryable(error: unknown): boolean {
    if (error instanceof RetryableError) return true;
    if (error instanceof TypeError) return true; // network error
    if (error instanceof Error) {
        const status = (error as Error & { status?: number }).status;
        if (status && status >= 400 && status < 500) return false; // 4xx — not retryable
        if (status && status >= 500) return true; // 5xx — retryable
    }
    return true; // unknown errors are retried
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    { maxRetries = 3, baseDelay = 1000, maxDelay = 10_000 }: RetryOptions = {}
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (!isRetryable(error) || attempt === maxRetries) throw error;
            const delay = Math.min(baseDelay * 2 ** attempt + Math.random() * 1000, maxDelay);
            await sleep(delay);
        }
    }

    throw lastError;
}
