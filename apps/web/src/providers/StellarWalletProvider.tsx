"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
} from "@creit.tech/stellar-wallets-kit";

import { offrampService } from "@/services/offramp.service";

export type WalletId = string;
export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnecting";

interface WalletContextType {
  connect: (walletId: WalletId) => Promise<void>;
  disconnect: () => Promise<void>;
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionStatus: ConnectionStatus;
  selectedWalletId: string | null;
  network: WalletNetwork;
  setNetwork: (network: WalletNetwork) => Promise<void>;
  signTransaction: (xdr: string) => Promise<string>;
  openModal: () => void;
  closeModal: () => void;
  isModalOpen: boolean;
  supportedWallets: { id: WalletId; name: string; icon: string }[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a StellarWalletProvider");
  }
  return context;
};

export const StellarWalletProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [address, setAddress] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [selectedWalletId, setSelectedWalletId] = useState<WalletId | null>(null);
  const [network, setNetworkState] = useState<WalletNetwork>(WalletNetwork.TESTNET);
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Holds the AbortController for the current in-flight connection attempt.
  // Aborting it signals connect() to discard any resolved address.
  const connectionAbortRef = useRef<AbortController | null>(null);

  // Initialize kit and handle persistence
  useEffect(() => {
    const walletKit = new StellarWalletsKit({
      network: network,
      modules: allowAllModules(),
    });
    setKit(walletKit);

    // RESTORE SESSION
    const savedAddress = localStorage.getItem("stellar_wallet_address");
    const savedWalletId = localStorage.getItem("stellar_wallet_id");
    const savedNetwork = localStorage.getItem("stellar_wallet_network");

    if (savedAddress && savedWalletId && savedNetwork === network) {
      setAddress(savedAddress);
      setSelectedWalletId(savedWalletId);
      setConnectionStatus("connected");
      walletKit.setWallet(savedWalletId);

      // Sync with backend on session restoration
      offrampService.syncWallet(savedAddress);
    }
  }, [network]);

  const disconnect = useCallback(async () => {
    // Abort any in-flight connection so its result is discarded
    if (connectionAbortRef.current) {
      connectionAbortRef.current.abort();
      connectionAbortRef.current = null;
    }

    setConnectionStatus("disconnecting");
    setAddress(null);
    setSelectedWalletId(null);
    localStorage.removeItem("stellar_wallet_address");
    localStorage.removeItem("stellar_wallet_id");
    localStorage.removeItem("stellar_wallet_network");
    setConnectionStatus("idle");
  }, []);

  const setNetwork = useCallback(
    async (newNetwork: WalletNetwork) => {
      if (newNetwork === network) return;

      // Block network switch while a connection is in progress — abort it first
      if (connectionAbortRef.current) {
        connectionAbortRef.current.abort();
        connectionAbortRef.current = null;
      }

      // Fully await disconnect so state is clean before the network changes
      await disconnect();
      setNetworkState(newNetwork);
    },
    [network, disconnect],
  );

  const supportedWallets: { id: WalletId; name: string; icon: string }[] = [
    { id: "freighter", name: "Freighter", icon: "/icons/freighter.png" },
    { id: "albedo", name: "Albedo", icon: "/icons/albedo.png" },
    { id: "xbull", name: "xBull", icon: "/icons/xbull.png" },
    { id: "rabet", name: "Rabet", icon: "/icons/rabet.png" },
    { id: "lobstr", name: "Lobstr", icon: "/icons/lobstr.png" },
  ];

  const connect = useCallback(
    async (walletId: WalletId) => {
      if (!kit) {
        console.error("Wallet kit not initialized");
        return;
      }

      // Abort any previous in-flight attempt before starting a new one
      if (connectionAbortRef.current) {
        connectionAbortRef.current.abort();
      }

      const controller = new AbortController();
      connectionAbortRef.current = controller;
      const { signal } = controller;

      setConnectionStatus("connecting");

      try {
        console.log(`Attempting to connect to ${walletId}...`);
        kit.setWallet(walletId);

        // Await the potentially long-running wallet handshake
        const response = await kit.getAddress();
        console.log("Wallet kit connection response:", response);

        // If disconnect() or setNetwork() was called while we were awaiting,
        // the signal is aborted — discard this result entirely.
        if (signal.aborted) {
          console.warn("Connection attempt was cancelled — discarding result.");
          return;
        }

        const { address: resolvedAddress } = response;

        if (!resolvedAddress) {
          throw new Error(
            "No address returned from wallet. Please ensure your wallet is unlocked and try again.",
          );
        }

        setAddress(resolvedAddress);
        setSelectedWalletId(walletId);
        setConnectionStatus("connected");
        localStorage.setItem("stellar_wallet_address", resolvedAddress);
        localStorage.setItem("stellar_wallet_id", walletId);
        localStorage.setItem("stellar_wallet_network", network);
        setIsModalOpen(false);

        // Sync with backend on new connection
        offrampService.syncWallet(resolvedAddress);
      } catch (error: unknown) {
        // Don't surface errors for intentionally aborted connections
        if (signal.aborted) return;

        console.error("Connection failed details:", error);

        let errorMessage = "Unknown connection error";
        if (error instanceof Error) errorMessage = error.message;
        else if (typeof error === "string") errorMessage = error;
        else if (error && typeof error === "object" && "message" in error)
          errorMessage = String((error as { message: unknown }).message);

        console.error("Connection failed message:", errorMessage);

        if (errorMessage.toLowerCase().includes("not installed")) {
          alert(
            `${walletId} wallet extension is not detected. Please install it or ensure it's enabled.`,
          );
        } else if (
          errorMessage.toLowerCase().includes("user rejected") ||
          errorMessage.toLowerCase().includes("permission denied")
        ) {
          console.warn("User rejected the connection request");
        } else {
          alert(`Failed to connect to ${walletId}: ${errorMessage}`);
        }

        setConnectionStatus("idle");
        throw error;
      } finally {
        // Only clear the ref if this controller is still the active one
        if (connectionAbortRef.current === controller) {
          connectionAbortRef.current = null;
        }
      }
    },
    [kit, network],
  );

  const signTransaction = useCallback(
    async (xdr: string) => {
      if (!kit || !address) throw new Error("Wallet not connected");
      try {
        const { signedTxXdr } = await kit.signTransaction(xdr);
        return signedTxXdr;
      } catch (error) {
        console.error("Signing failed:", error);
        throw error;
      }
    },
    [kit, address],
  );

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  return (
    <WalletContext.Provider
      value={{
        connect,
        disconnect,
        address,
        isConnected: connectionStatus === "connected",
        isConnecting: connectionStatus === "connecting",
        connectionStatus,
        selectedWalletId,
        network,
        setNetwork,
        signTransaction,
        openModal,
        closeModal,
        isModalOpen,
        supportedWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
