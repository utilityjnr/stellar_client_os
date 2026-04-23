"use client";
 
import React, { useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
 
import type { CreateOfframpResponse, OfframpFormState } from "@/types/offramp";
import { getCurrencySymbol } from "@/types/offramp";
 
interface OfframpQuoteModalProps {
    isOpen: boolean;
    offrampData: CreateOfframpResponse["data"] | null;
    formState: OfframpFormState;
    onClose: () => void;
    onConfirm: () => void;
    isLoading: boolean;
    isSubmitting?: boolean;
}
 
export default function OfframpQuoteModal({
    isOpen,
    offrampData,
    formState,
    onClose,
    onConfirm,
    isLoading,
    isSubmitting = false,
}: OfframpQuoteModalProps) {
    const handleClose = useCallback(() => {
        if (!isLoading) onClose();
    }, [isLoading, onClose]);
 
    if (!isOpen || !offrampData) return null;
 
    const currencySymbol = getCurrencySymbol(offrampData.currency);
 
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent 
                className="bg-fundable-mid-dark border border-fundable-purple p-6 w-full max-w-md mx-4 relative"
            >
                <DialogHeader>
                    <DialogTitle id="offramp-quote-title" className="text-xl font-syne font-semibold text-white mb-6">
                        Confirm Offramp
                    </DialogTitle>
                    <DialogDescription id="offramp-quote-desc" className="sr-only">
                        Review the transaction breakdown and confirm your offramp request.
                    </DialogDescription>
                </DialogHeader>
 
                <div className="space-y-4">
                    <div className="bg-fundable-dark p-4 rounded-lg">
                        <p className="text-fundable-light-grey text-sm">You Send</p>
                        <p className="text-white text-xl font-semibold">
                            {parseFloat(formState.amount).toFixed(4)} {formState.token}
                        </p>
                    </div>
 
                    <div className="bg-fundable-dark p-4 rounded-lg">
                        <p className="text-fundable-light-grey text-sm">Total Payout</p>
                        <p className="text-white text-2xl font-bold">
                            {currencySymbol}{offrampData.fiatAmount.toLocaleString()}
                        </p>
                    </div>
 
                    <div className="space-y-3 bg-fundable-dark/50 p-4 rounded-lg border border-gray-800 text-sm">
                        <div className="flex justify-between items-center text-xs text-fundable-light-grey uppercase tracking-wider mb-1">
                            <span>Transaction Breakdown</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-fundable-light-grey">Reference</span>
                            <span className="text-white text-[10px] font-mono opacity-80">{offrampData.reference}</span>
                        </div>
                    </div>
 
                    <div className="bg-fundable-dark p-4 rounded-lg">
                        <p className="text-fundable-light-grey text-sm mb-2">Bank Details</p>
                        <p className="text-white font-medium">{formState.accountName}</p>
                        <p className="text-white">{formState.accountNumber}</p>
                    </div>
 
                    <div className="flex gap-4 mt-6">
                        <Button
                            onClick={onClose}
                            disabled={isLoading}
                            variant="secondary"
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white border-none h-12"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={onConfirm}
                            disabled={isLoading || isSubmitting}
                            className="flex-1 bg-gradient-to-r from-fundable-purple-2 to-purple-500 text-black h-12"
                        >
                            {isLoading || isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Confirming...
                                </>
                            ) : (
                                "Confirm"
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}