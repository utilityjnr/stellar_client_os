"use client";

import React from "react";
import type { OfframpStep, QuoteStatusData } from "@/types/offramp";
import { CheckCircle2, Loader2, XCircle, ExternalLink } from "lucide-react";

interface BridgeStatusTrackerProps {
    step: OfframpStep;
    bridgeTxHash: string | null;
    payoutStatus: QuoteStatusData | null;
    error: string | null;
    onReset: () => void;
}

interface StatusStep {
    label: string;
    description: string;
    status: "pending" | "active" | "completed" | "failed";
}

export function BridgeStatusTracker({
    step,
    bridgeTxHash,
    payoutStatus,
    error,
    onReset,
}: BridgeStatusTrackerProps) {
    const steps: StatusStep[] = [
        {
            label: "Wallet Signed",
            description: "Transaction signed by your Stellar wallet",
            status:
                step === "signing"
                    ? "active"
                    : ["bridging", "processing", "completed"].includes(step)
                        ? "completed"
                        : step === "failed"
                            ? "failed"
                            : "pending",
        },
        {
            label: "Bridging to Polygon",
            description: "Transferring USDC via Allbridge Core",
            status:
                step === "bridging"
                    ? "active"
                    : ["processing", "completed"].includes(step)
                        ? "completed"
                        : step === "failed" && bridgeTxHash
                            ? "failed"
                            : "pending",
        },
        {
            label: "Processing Payout",
            description: "Backend converting to local currency",
            status:
                step === "processing"
                    ? "active"
                    : step === "completed"
                        ? "completed"
                        : step === "failed" && payoutStatus
                            ? "failed"
                            : "pending",
        },
        {
            label: "Completed",
            description: "Funds sent to your bank account",
            status: step === "completed" ? "completed" : "pending",
        },
    ];

    return (
        <div className="bg-fundable-mid-dark rounded-2xl p-6 border border-gray-800 space-y-6 animate-in fade-in duration-500">
            <h2 className="text-xl font-syne font-semibold text-white">
                Transaction Progress
            </h2>

            {/* Progress Steps */}
            <div className="space-y-1">
                {steps.map((s, i) => (
                    <div key={s.label} className="flex items-start gap-4">
                        {/* Step indicator + line */}
                        <div className="flex flex-col items-center">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${s.status === "completed"
                                    ? "bg-green-500/20 text-green-500"
                                    : s.status === "active"
                                        ? "bg-fundable-purple-2/20 text-fundable-purple-2"
                                        : s.status === "failed"
                                            ? "bg-red-500/20 text-red-500"
                                            : "bg-white/5 text-gray-400"
                                    }`}
                            >
                                {s.status === "completed" ? (
                                    <CheckCircle2 className="h-5 w-5" />
                                ) : s.status === "active" ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : s.status === "failed" ? (
                                    <XCircle className="h-5 w-5" />
                                ) : (
                                    <div className="w-2 h-2 rounded-full bg-current opacity-30" />
                                )}
                            </div>
                            {/* Connecting line */}
                            {i < steps.length - 1 && (
                                <div
                                    className={`w-0.5 h-12 ${s.status === "completed" ? "bg-green-500/30" : "bg-gray-800"
                                        }`}
                                />
                            )}
                        </div>

                        {/* Step content */}
                        <div className="pt-2 pb-6">
                            <p
                                className={`text-sm font-semibold ${s.status === "active"
                                    ? "text-white"
                                    : s.status === "completed"
                                        ? "text-green-500"
                                        : s.status === "failed"
                                            ? "text-red-500"
                                            : "text-gray-500"
                                    }`}
                            >
                                {s.label}
                            </p>
                            <p className="text-xs text-fundable-light-grey mt-0.5">{s.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Transaction Links */}
            {bridgeTxHash && (
                <div className="p-4 rounded-xl bg-fundable-dark border border-gray-800 space-y-2">
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-fundable-light-grey font-medium uppercase tracking-wider">Stellar Transaction</p>
                        <a
                            href={`https://stellar.expert/explorer/public/tx/${bridgeTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-fundable-purple hover:text-fundable-violet flex items-center gap-1 text-xs"
                        >
                            View Explorer <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono truncate">{bridgeTxHash}</p>
                </div>
            )}

            {/* Provider Status Message */}
            {payoutStatus?.providerMessage && (
                <div className="px-4 py-3 rounded-xl bg-fundable-dark border border-gray-800">
                    <p className="text-xs text-fundable-light-grey mb-1 uppercase tracking-wider">Provider Status</p>
                    <p className="text-sm text-white">{payoutStatus.providerMessage}</p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {/* Reset Action */}
            {step === "failed" && (
                <button
                    onClick={onReset}
                    className="w-full h-12 rounded-xl font-bold bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                >
                    Try Again
                </button>
            )}
        </div>
    );
}
