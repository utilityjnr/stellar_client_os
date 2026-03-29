"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface GuardOptions {
    cooldownMs?: number;
}

interface UseTransactionGuardReturn {
    isSubmitting: boolean;
    isCoolingDown: boolean;
    isGuardActive: boolean;
    runWithGuard: <T>(fn: () => Promise<T>, options?: GuardOptions) => Promise<T | undefined>;
}

/**
 * Prevents duplicate async submissions by blocking re-entry while work is in flight
 * and for a short cooldown period after a successful submission.
 */
export function useTransactionGuard(defaultCooldownMs = 2000): UseTransactionGuardReturn {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCoolingDown, setIsCoolingDown] = useState(false);
    const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lockRef = useRef(false);
    const isGuardActive = isSubmitting || isCoolingDown || lockRef.current;

    useEffect(() => {
        return () => {
            if (cooldownRef.current) {
                clearTimeout(cooldownRef.current);
            }
        };
    }, []);

    const runWithGuard = useCallback(
        async <T,>(fn: () => Promise<T>, options?: GuardOptions): Promise<T | undefined> => {
            if (isGuardActive) {
                return undefined;
            }

            lockRef.current = true;
            setIsSubmitting(true);

            try {
                const result = await fn();
                const cooldownMs = options?.cooldownMs ?? defaultCooldownMs;

                if (cooldownMs > 0) {
                    setIsCoolingDown(true);
                    cooldownRef.current = setTimeout(() => {
                        setIsCoolingDown(false);
                        cooldownRef.current = null;
                    }, cooldownMs);
                }

                return result;
            } finally {
                lockRef.current = false;
                setIsSubmitting(false);
            }
        },
        [defaultCooldownMs, isGuardActive]
    );

    return {
        isSubmitting,
        isCoolingDown,
        isGuardActive,
        runWithGuard,
    };
}
