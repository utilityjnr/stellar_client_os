'use client';

import { useState, useCallback } from 'react';
import { DistributionState, TransactionSummary } from '@/types/distribution';
import { StellarService } from '@/services/stellar.service';

interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

interface UseDistributionTransactionReturn {
  isLoading: boolean;
  error: string | null;
  executeTransaction: (state: DistributionState) => Promise<TransactionResult>;
  prepareSummary: (state: DistributionState) => TransactionSummary;
  reset: () => void;
}

export function useDistributionTransaction(
  stellarService: StellarService,
  senderAddress: string,
  tokenAddress: string = 'native' // Default to XLM
): UseDistributionTransactionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepareSummary = useCallback((state: DistributionState): TransactionSummary => {
    const totalAmount = state.type === 'equal'
      ? state.totalAmount
      : state.recipients.reduce((sum, recipient) => {
        return sum + (parseFloat(recipient.amount || '0'));
      }, 0).toString();

    return {
      type: state.type,
      recipientCount: state.recipients.length,
      totalAmount,
      tokenSymbol: tokenAddress === 'native' ? 'XLM' : 'TOKEN',
      estimatedFee: '0.00001', // Base fee for Stellar transaction
    };
  }, [tokenAddress]);

  const executeTransaction = useCallback(async (
    state: DistributionState
  ): Promise<TransactionResult> => {
    setIsLoading(true);
    setError(null);

    try {
      if (state.recipients.length === 0) {
        throw new Error('No recipients provided');
      }

      const recipients = state.recipients.map(r => r.address);
      let transactionHash: string;

      if (state.type === 'equal') {
        const totalAmountStroops = Math.floor(parseFloat(state.totalAmount) * 10000000);
        // Casting to any to avoid argument mismatch with the complex StellarService types in this context
        const result = await (stellarService as any).distributeEqual({
          token: tokenAddress,
          totalAmount: totalAmountStroops.toString(),
          recipients: recipients
        }, senderAddress);
        transactionHash = typeof result === 'string' ? result : (result?.hash || '');
      } else {
        const amounts = state.recipients.map(r => {
          const amountStroops = Math.floor(parseFloat(r.amount!) * 10000000);
          return amountStroops.toString();
        });

        const result = await (stellarService as any).distributeWeighted({
          token: tokenAddress,
          recipients,
          amounts
        }, senderAddress);
        transactionHash = typeof result === 'string' ? result : (result?.hash || '');
      }

      return {
        success: true,
        transactionHash,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
      setError(errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, [stellarService, senderAddress, tokenAddress]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    executeTransaction,
    prepareSummary,
    reset,
  };
}