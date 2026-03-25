"use client";

import toast from "react-hot-toast";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/providers/StellarWalletProvider";

import { PaymentStreamForm } from "./PaymentStreamForm";
import { PaymentStreamSummary } from "./PaymentStreamSummary";
import { PaymentStreamConfirmationModal } from "./PaymentStreamConfirmationModal";
import { capitalizeWord } from "@/lib/utils";
import { SUPPORTED_TOKENS, PaymentStreamFormData } from "@/lib/validations";
import { StellarService } from "@/lib/stellar";

// Stream form state type
interface StreamFormData {
    name: string;
    recipient: string;
    token: string;
    amount: string;
    duration: string;
    durationValue: string;
    cancellability: boolean;
    transferability: boolean;
}

const CreatePaymentStream = () => {
    const { address, isConnected } = useWallet();
    const queryClient = useQueryClient();

    const tokenOptions = SUPPORTED_TOKENS.map((token) => ({
        label: token.label,
        value: token.value,
    }));

    const durationOptions = ["hour", "day", "week", "month", "year"].map(
        (option) => ({
            label: capitalizeWord(option),
            value: option,
        })
    );

    const [streamData, setStreamData] = useState<StreamFormData>({
        name: "",
        recipient: "",
        token: tokenOptions[0]?.value || "XLM",
        amount: "",
        duration: durationOptions[0]?.value || "day",
        durationValue: "",
        cancellability: true,
        transferability: false,
    });
    const [formKey, setFormKey] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);

    const selectedToken = useMemo(() => {
        return SUPPORTED_TOKENS.find((t) => t.value === streamData.token);
    }, [streamData.token]);

    const handleFormSubmit = () => {
        if (!isConnected || !address) {
            toast.error("Connect your wallet");
            return;
        }

        // Basic validation
        if (!streamData.name.trim()) {
            toast.error("Stream name is required");
            return;
        }
        if (!streamData.recipient.trim()) {
            toast.error("Recipient address is required");
            return;
        }
        if (!StellarService.validateStellarAddress(streamData.recipient)) {
            toast.error("Invalid Stellar address");
            return;
        }
        if (!streamData.amount || parseFloat(streamData.amount) <= 0) {
            toast.error("Amount must be greater than 0");
            return;
        }
        if (!streamData.durationValue || parseInt(streamData.durationValue) <= 0) {
            toast.error("Duration must be greater than 0");
            return;
        }

        // Show confirmation modal
        setShowConfirmationModal(true);
    };

    const handleConfirmStream = async () => {
        // Close modal immediately to show loading state on form
        setShowConfirmationModal(false);

        try {
            setIsSubmitting(true);

            // Convert form data to the format expected by StellarService
            const formData: PaymentStreamFormData = {
                recipientAddress: streamData.recipient,
                token: streamData.token,
                totalAmount: streamData.amount,
                duration: streamData.durationValue,
                durationUnit: streamData.duration === "hour" ? "hours" : "days",
                cancelable: streamData.cancellability,
                transferable: streamData.transferability,
            };

            const streamId = await StellarService.createPaymentStream(formData);

            toast.success(
                `Stream created successfully! ID: ${streamId.slice(0, 10)}...`
            );

            // Reset form
            setStreamData({
                name: "",
                recipient: "",
                token: tokenOptions[0]?.value || "XLM",
                amount: "",
                duration: durationOptions[0]?.value || "day",
                durationValue: "",
                cancellability: true,
                transferability: false,
            });
            setFormKey((k) => k + 1);

            // Invalidate streams queries
            await queryClient.invalidateQueries({
                queryKey: ["payment-streams-table"],
            });

            // Set a temporary query data to indicate tab should switch
            queryClient.setQueryData(["stream-created-switch-tab"], true);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to create stream";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseModal = () => {
        if (!isSubmitting) {
            setShowConfirmationModal(false);
        }
    };

    return (
        <>
            <main className="flex flex-col lg:flex-row gap-6 w-full">
                <div className="w-full lg:w-[70%]">
                    <div id="create-stream-card" className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-6">
                        <div className="mb-6">
                            <h2 className="text-xl font-semibold text-zinc-50 mb-2">Create New Stream</h2>
                            <p className="text-zinc-400 text-sm">
                                Set up a continuous payment stream on the Stellar network
                            </p>
                        </div>

                        <PaymentStreamForm
                            key={formKey}
                            streamData={streamData}
                            tokenOptions={tokenOptions}
                            setStreamData={setStreamData}
                            durationOptions={durationOptions}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    </div>
                </div>
                <div className="w-full lg:w-[30%]">
                    <PaymentStreamSummary streamData={streamData} />
                </div>
            </main>

            <PaymentStreamConfirmationModal
                open={showConfirmationModal}
                onOpenChange={handleCloseModal}
                data={{
                    recipientAddress: streamData.recipient,
                    token: streamData.token,
                    totalAmount: streamData.amount,
                    duration: streamData.durationValue,
                    durationUnit: streamData.duration === "hour" ? "hours" : "days",
                    cancelable: streamData.cancellability,
                    transferable: streamData.transferability,
                }}
                onConfirm={handleConfirmStream}
                isSubmitting={isSubmitting}
            />
        </>
    );
};

export default CreatePaymentStream;
