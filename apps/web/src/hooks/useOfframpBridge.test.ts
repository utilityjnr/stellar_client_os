import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useOfframpBridge } from "./useOfframpBridge";

// --- Mocks ---

vi.mock("@/providers/StellarWalletProvider", () => ({
    useWallet: vi.fn(),
}));

vi.mock("@/services/offramp.service", () => ({
    offrampService: {
        getBankList: vi.fn(),
        verifyBankAccount: vi.fn(),
        getAggregatedRates: vi.fn(),
        createOfframp: vi.fn(),
        updateQuoteTxHash: vi.fn(),
        getQuoteStatus: vi.fn(),
    },
}));

vi.mock("@/services/allbridge.service", () => ({
    allbridgeService: {
        getBridgeQuote: vi.fn(),
        buildBridgeTransaction: vi.fn(),
        handleBumpIfNeeded: vi.fn(),
        submitTransaction: vi.fn(),
        getTransferStatus: vi.fn(),
    },
}));

vi.mock("@/services/offramp.mock", () => ({
    isOfframpMockEnabled: false,
    getMockDelay: vi.fn(() => 0),
    getMockBridgeQuote: vi.fn(),
    createMockTxHash: vi.fn(() => "mock-tx-hash"),
}));

vi.mock("@/lib/api", () => ({
    fetchAccountInfo: vi.fn().mockResolvedValue({
        balances: [{ assetCode: "USDC", balance: "100.00" }],
    }),
}));

import { useWallet } from "@/providers/StellarWalletProvider";
import { offrampService } from "@/services/offramp.service";
import { allbridgeService } from "@/services/allbridge.service";

const mockSignTransaction = vi.fn().mockResolvedValue("signed-xdr");

const mockWallet = {
    address: "GABC123",
    isConnected: true,
    signTransaction: mockSignTransaction,
    network: "testnet",
};

const mockQuote = {
    providerId: "cashwyre",
    displayName: "Cashwyre",
    cryptoAmount: 10,
    fiatAmount: 15500,
    rate: 1550,
    fee: 62,
    currency: "NGN",
    token: "USDC",
    network: "polygon",
    expiresAt: new Date(Date.now() + 300000).toISOString(),
};

const mockOfframpData = {
    providerId: "cashwyre",
    reference: "ref-123",
    depositAddress: "polygon-addr",
    depositAmount: 10,
    depositToken: "USDC",
    depositNetwork: "polygon",
    fiatAmount: 15500,
    currency: "NGN",
    status: "pending",
    expiresAt: new Date(Date.now() + 600000).toISOString(),
};

const mockBridgeQuote = {
    sendAmount: "10.15",
    receiveAmount: "10",
    bridgeFee: "0.15",
    estimatedTimeMinutes: 6,
};

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
}

/** Drain all fake timers and flush microtasks */
async function drainTimers() {
    await act(async () => {
        await vi.runAllTimersAsync();
    });
}

describe("useOfframpBridge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        (useWallet as ReturnType<typeof vi.fn>).mockReturnValue(mockWallet);
        (offrampService.getBankList as ReturnType<typeof vi.fn>).mockResolvedValue({
            success: true,
            data: [{ code: "044", name: "Access Bank" }],
        });
        (offrampService.getAggregatedRates as ReturnType<typeof vi.fn>).mockResolvedValue({
            success: true,
            data: { best: mockQuote, all: [mockQuote], errors: [], timestamp: new Date().toISOString() },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // --- Initial state ---

    it("returns correct initial state", () => {
        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });

        expect(result.current.step).toBe("form");
        expect(result.current.error).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.quote).toBeNull();
        expect(result.current.bridgeQuote).toBeNull();
        expect(result.current.feeBreakdown).toBeNull();
        expect(result.current.offrampData).toBeNull();
        expect(result.current.bridgeTxHash).toBeNull();
        expect(result.current.payoutStatus).toBeNull();
        expect(result.current.formState).toEqual({
            token: "USDC",
            amount: "",
            country: "NG",
            bankCode: "",
            accountNumber: "",
            accountName: "",
        });
    });

    // --- handleFormChange ---

    it("handleFormChange updates form field", () => {
        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });

        act(() => { result.current.handleFormChange("amount", "50"); });

        expect(result.current.formState.amount).toBe("50");
    });

    it("handleFormChange clears accountName when bankCode changes", () => {
        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });

        act(() => { result.current.handleFormChange("bankCode", "044"); });

        expect(result.current.formState.accountName).toBe("");
    });

    it("handleFormChange clears quote and quoteError when amount changes", async () => {
        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });

        // Trigger quote fetch and drain debounce + async
        act(() => { result.current.handleFormChange("amount", "10"); });
        await drainTimers();
        expect(result.current.quote).toEqual(mockQuote);

        // Changing amount clears quote immediately
        act(() => { result.current.handleFormChange("amount", "20"); });
        expect(result.current.quote).toBeNull();
        expect(result.current.quoteError).toBeNull();
    });

    // --- Quote fetching (real-time effect) ---

    it("fetches quote when amount is set", async () => {
        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });

        act(() => { result.current.handleFormChange("amount", "10"); });
        await drainTimers();

        expect(result.current.quote).toEqual(mockQuote);
        expect(result.current.quoteError).toBeNull();
    });

    it("sets quoteError when rate fetch fails", async () => {
        (offrampService.getAggregatedRates as ReturnType<typeof vi.fn>).mockResolvedValue({
            success: false,
            error: "No rates available",
        });

        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });

        act(() => { result.current.handleFormChange("amount", "10"); });
        await drainTimers();

        expect(result.current.quoteError).toBe("No rates available");
        expect(result.current.quote).toBeNull();
    });

    it("sets quoteError on network error during rate fetch", async () => {
        (offrampService.getAggregatedRates as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error("Network error")
        );

        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });

        act(() => { result.current.handleFormChange("amount", "10"); });
        await drainTimers();

        expect(result.current.quoteError).toBe("Failed to fetch rates");
    });

    // --- getQuote (form → quote step) ---

    it("getQuote transitions step to 'quote' on success", async () => {
        (offrampService.createOfframp as ReturnType<typeof vi.fn>).mockResolvedValue({
            success: true,
            data: mockOfframpData,
        });
        (allbridgeService.getBridgeQuote as ReturnType<typeof vi.fn>).mockResolvedValue(mockBridgeQuote);

        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });

        act(() => { result.current.handleFormChange("amount", "10"); });
        await drainTimers();
        expect(result.current.quote).not.toBeNull();

        await act(async () => { await result.current.getQuote({ ...result.current.formState }); });

        expect(result.current.step).toBe("quote");
        expect(result.current.bridgeQuote).toEqual(mockBridgeQuote);
        expect(result.current.feeBreakdown).not.toBeNull();
        expect(result.current.offrampData).toEqual(mockOfframpData);
        expect(result.current.isLoading).toBe(false);
    });

    it("getQuote sets error when wallet not connected", async () => {
        (useWallet as ReturnType<typeof vi.fn>).mockReturnValue({ ...mockWallet, isConnected: false, address: null });

        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });

        await act(async () => { await result.current.getQuote(result.current.formState); });

        expect(result.current.error).toBe("Please connect your wallet first");
        expect(result.current.step).toBe("form");
    });

    it("getQuote sets error when no quote available", async () => {
        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });

        await act(async () => { await result.current.getQuote(result.current.formState); });

        expect(result.current.error).toBe("No valid quote available. Please check your input.");
    });

    it("getQuote sets error when createOfframp fails", async () => {
        (offrampService.createOfframp as ReturnType<typeof vi.fn>).mockResolvedValue({
            success: false,
            error: "Offramp creation failed",
        });

        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });

        act(() => { result.current.handleFormChange("amount", "10"); });
        await drainTimers();
        expect(result.current.quote).not.toBeNull();

        await act(async () => { await result.current.getQuote({ ...result.current.formState }); });

        expect(result.current.error).toBe("Offramp creation failed");
        expect(result.current.step).toBe("form");
    });

    // --- confirmAndBridge ---

    async function setupToQuoteStep(result: { current: ReturnType<typeof useOfframpBridge> }) {
        act(() => { result.current.handleFormChange("amount", "10"); });
        await drainTimers();
        expect(result.current.quote).not.toBeNull();
        await act(async () => { await result.current.getQuote({ ...result.current.formState }); });
        expect(result.current.step).toBe("quote");
    }

    it("confirmAndBridge transitions through signing → bridging", async () => {
        (offrampService.createOfframp as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: mockOfframpData });
        (allbridgeService.getBridgeQuote as ReturnType<typeof vi.fn>).mockResolvedValue(mockBridgeQuote);
        (allbridgeService.buildBridgeTransaction as ReturnType<typeof vi.fn>).mockResolvedValue("raw-xdr");
        (allbridgeService.handleBumpIfNeeded as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        (allbridgeService.submitTransaction as ReturnType<typeof vi.fn>).mockResolvedValue("tx-hash-abc");
        (offrampService.updateQuoteTxHash as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });
        await setupToQuoteStep(result);

        await act(async () => { await result.current.confirmAndBridge(); });

        expect(result.current.step).toBe("bridging");
        expect(result.current.bridgeTxHash).toBe("tx-hash-abc");
    });

    it("confirmAndBridge sets step to 'quote' when user cancels signing", async () => {
        (offrampService.createOfframp as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: mockOfframpData });
        (allbridgeService.getBridgeQuote as ReturnType<typeof vi.fn>).mockResolvedValue(mockBridgeQuote);
        (allbridgeService.buildBridgeTransaction as ReturnType<typeof vi.fn>).mockResolvedValue("raw-xdr");
        (allbridgeService.handleBumpIfNeeded as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        mockSignTransaction.mockRejectedValueOnce(new Error("User declined"));

        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });
        await setupToQuoteStep(result);

        await act(async () => { await result.current.confirmAndBridge(); });

        expect(result.current.step).toBe("quote");
        expect(result.current.error).toBe("Transaction cancelled");
    });

    it("confirmAndBridge sets step to 'failed' on bridge error", async () => {
        (offrampService.createOfframp as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: mockOfframpData });
        (allbridgeService.getBridgeQuote as ReturnType<typeof vi.fn>).mockResolvedValue(mockBridgeQuote);
        (allbridgeService.buildBridgeTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error("Bridge network error")
        );

        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });
        await setupToQuoteStep(result);

        await act(async () => { await result.current.confirmAndBridge(); });

        expect(result.current.step).toBe("failed");
        expect(result.current.error).toBe("Bridge network error");
    });

    it("confirmAndBridge sets error when missing required data", async () => {
        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });

        await act(async () => { await result.current.confirmAndBridge(); });

        expect(result.current.error).toBe("Missing required data");
    });

    // --- Payout polling ---

    it("payout polling transitions to 'completed'", async () => {
        (offrampService.createOfframp as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: mockOfframpData });
        (allbridgeService.getBridgeQuote as ReturnType<typeof vi.fn>).mockResolvedValue(mockBridgeQuote);
        (allbridgeService.buildBridgeTransaction as ReturnType<typeof vi.fn>).mockResolvedValue("raw-xdr");
        (allbridgeService.handleBumpIfNeeded as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        (allbridgeService.submitTransaction as ReturnType<typeof vi.fn>).mockResolvedValue("tx-hash-abc");
        (offrampService.updateQuoteTxHash as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
        (allbridgeService.getTransferStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "completed" });
        (offrampService.getQuoteStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
            success: true,
            data: { status: "completed", providerMessage: "Done" },
        });

        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });
        await setupToQuoteStep(result);
        await act(async () => { await result.current.confirmAndBridge(); });
        expect(result.current.step).toBe("bridging");

        // Fire bridge poll interval (15s) → processing
        await act(async () => { vi.advanceTimersByTime(15000); });
        await act(async () => { await Promise.resolve(); });
        expect(result.current.step).toBe("processing");

        // Fire payout poll interval (10s) → completed
        await act(async () => { vi.advanceTimersByTime(10000); });
        await act(async () => { await Promise.resolve(); });
        expect(result.current.step).toBe("completed");
    });

    it("payout polling transitions to 'failed'", async () => {
        (offrampService.createOfframp as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: mockOfframpData });
        (allbridgeService.getBridgeQuote as ReturnType<typeof vi.fn>).mockResolvedValue(mockBridgeQuote);
        (allbridgeService.buildBridgeTransaction as ReturnType<typeof vi.fn>).mockResolvedValue("raw-xdr");
        (allbridgeService.handleBumpIfNeeded as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        (allbridgeService.submitTransaction as ReturnType<typeof vi.fn>).mockResolvedValue("tx-hash-abc");
        (offrampService.updateQuoteTxHash as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
        (allbridgeService.getTransferStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "completed" });
        (offrampService.getQuoteStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
            success: true,
            data: { status: "failed", providerMessage: "Payout rejected" },
        });

        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });
        await setupToQuoteStep(result);
        await act(async () => { await result.current.confirmAndBridge(); });

        await act(async () => { vi.advanceTimersByTime(15000); });
        await act(async () => { await Promise.resolve(); });
        expect(result.current.step).toBe("processing");

        await act(async () => { vi.advanceTimersByTime(10000); });
        await act(async () => { await Promise.resolve(); });
        expect(result.current.step).toBe("failed");
        expect(result.current.error).toBe("Payout rejected");
    });

    // --- goBack ---

    it("goBack from 'quote' returns to 'form' and clears quote data", async () => {
        (offrampService.createOfframp as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: mockOfframpData });
        (allbridgeService.getBridgeQuote as ReturnType<typeof vi.fn>).mockResolvedValue(mockBridgeQuote);

        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });
        await setupToQuoteStep(result);

        act(() => { result.current.goBack(); });

        expect(result.current.step).toBe("form");
        expect(result.current.bridgeQuote).toBeNull();
        expect(result.current.feeBreakdown).toBeNull();
        expect(result.current.offrampData).toBeNull();
        expect(result.current.error).toBeNull();
    });

    // --- reset ---

    it("reset returns hook to initial state", async () => {
        (offrampService.createOfframp as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: mockOfframpData });
        (allbridgeService.getBridgeQuote as ReturnType<typeof vi.fn>).mockResolvedValue(mockBridgeQuote);

        const { result } = renderHook(() => useOfframpBridge(), { wrapper: createWrapper() });
        await setupToQuoteStep(result);

        act(() => { result.current.reset(); });

        expect(result.current.step).toBe("form");
        expect(result.current.error).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.formState.amount).toBe("");
        expect(result.current.formState.bankCode).toBe("");
        expect(result.current.formState.accountNumber).toBe("");
        expect(result.current.formState.accountName).toBe("");
        expect(result.current.bridgeQuote).toBeNull();
        expect(result.current.feeBreakdown).toBeNull();
        expect(result.current.offrampData).toBeNull();
        expect(result.current.payoutStatus).toBeNull();
    });
});
