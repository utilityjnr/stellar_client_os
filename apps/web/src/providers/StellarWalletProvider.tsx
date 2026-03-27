"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
} from "@creit.tech/stellar-wallets-kit";

import { offrampService } from "@/services/offramp.service";
import { notify } from "@/utils/notification";

export type WalletId = string;

interface WalletContextType {
  connect: (walletId: WalletId) => Promise<void>;
  disconnect: () => Promise<void>;
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  selectedWalletId: string | null;
  network: WalletNetwork;
  setNetwork: (network: WalletNetwork) => void;
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<WalletId | null>(
    null,
  );
  const [network, setNetworkState] = useState<WalletNetwork>(
    WalletNetwork.TESTNET,
  );
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      walletKit.setWallet(savedWalletId);

      // Sync with backend on session restoration
      offrampService.syncWallet(savedAddress);
    }
  }, [network]);

  const disconnect = useCallback(async () => {
    setAddress(null);
    setSelectedWalletId(null);
    localStorage.removeItem("stellar_wallet_address");
    localStorage.removeItem("stellar_wallet_id");
    localStorage.removeItem("stellar_wallet_network");
  }, []);

  const setNetwork = (newNetwork: WalletNetwork) => {
    if (newNetwork !== network) {
      disconnect();
      setNetworkState(newNetwork);
    }
  };

  const supportedWallets: { id: WalletId; name: string; icon: string }[] = [
    { id: "freighter", name: "Freighter", icon: "/icons/freighter.png" },
    { id: "albedo", name: "Albedo", icon: "/icons/albedo.png" },
    { id: "xbull", name: "xBull", icon: "/icons/xbull.png" },
    { id: "rabet", name: "Rabet", icon: "/icons/rabet.png" },
    { id: "lobstr", name: "Lobstr", icon: "/icons/lobstr.png" },
  ];

  const WALLET_INSTALL_URL: Partial<Record<WalletId, string>> = {
    freighter: "https://freighter.app/",
    xbull: "https://xbull.app/",
    rabet: "https://rabet.io/",
    albedo: "https://albedo.link/",
    lobstr: "https://lobstr.co/",
  };

  const connect = async (walletId: WalletId) => {
    if (!kit) {
      console.error("Wallet kit not initialized");
      return;
    }
    setIsConnecting(true);
    try {
      console.log(`Attempting to connect to ${walletId}...`);
      kit.setWallet(walletId);

      // Some wallets might need a moment to initialize the module
      const response = await kit.getAddress();
      console.log("Wallet kit connection response:", response);

      const { address } = response;

      if (!address) {
        throw new Error("No address returned from wallet. Please ensure your wallet is unlocked and try again.");
      }

      setAddress(address);
      setSelectedWalletId(walletId);
      localStorage.setItem("stellar_wallet_address", address);
      localStorage.setItem("stellar_wallet_id", walletId);
      localStorage.setItem("stellar_wallet_network", network);
      setIsModalOpen(false);

      // Sync with backend on new connection
      offrampService.syncWallet(address);
    } catch (error: any) {
      console.error("Connection failed details:", error);

      // Extract the most useful error message
      let errorMessage = "Unknown connection error";
      if (error instanceof Error) errorMessage = error.message;
      else if (typeof error === "string") errorMessage = error;
      else if (error && typeof error === "object" && error.message) errorMessage = error.message;

      console.error("Connection failed message:", errorMessage);

      // Handle known error conditions
      if (errorMessage.toLowerCase().includes("not installed")) {
        const installHref = WALLET_INSTALL_URL[walletId];

        notify.error(
          <div className="flex flex-col gap-1">
            <span>{walletId} wallet extension is not detected.</span>
            {installHref ? (
              <a
                href={installHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors underline underline-offset-2"
              >
                Install / get wallet
              </a>
            ) : (
              <span className="text-xs text-white/70">
                Install the wallet extension (or enable it) and try again.
              </span>
            )}
          </div>,
        );
      } else if (errorMessage.toLowerCase().includes("user rejected") || errorMessage.toLowerCase().includes("permission denied")) {
        console.warn("User rejected the connection request");
      } else {
        // Show a generic but helpful error for other errors
        notify.error(`Failed to connect to ${walletId}: ${errorMessage}`);
      }

      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

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

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <WalletContext.Provider
      value={{
        connect,
        disconnect,
        address,
        isConnected: !!address,
        isConnecting,
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
