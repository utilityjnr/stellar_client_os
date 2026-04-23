/**
 * Types for the ContractDeployer module.
 */

/** Supported Stellar networks. */
export type StellarNetwork = 'testnet' | 'mainnet' | 'custom';

/** Configuration for the deployer. */
export interface DeployerConfig {
  /** Soroban RPC endpoint. */
  rpcUrl: string;
  /** Network passphrase. */
  networkPassphrase: string;
  /**
   * Base fee in stroops for each transaction.
   * Defaults to 100 stroops (the Stellar base fee).
   */
  baseFee?: string;
  /**
   * Maximum seconds to wait for transaction confirmation.
   * Defaults to 60.
   */
  timeoutSeconds?: number;
}

/** Result of a WASM upload (install) operation. */
export interface WasmUploadResult {
  /** SHA-256 hash of the uploaded WASM, used to reference it during instantiation. */
  wasmHash: string;
  /** Transaction hash of the upload transaction. */
  txHash: string;
  /** Ledger number where the transaction was included. */
  ledger: number;
  /** Estimated fee that was actually charged (in stroops). */
  feeCharged: string;
}

/** Result of a contract instantiation (deploy) operation. */
export interface ContractDeployResult {
  /** The deployed contract's address (C... address). */
  contractId: string;
  /** Transaction hash of the deploy transaction. */
  txHash: string;
  /** Ledger number where the transaction was included. */
  ledger: number;
  /** Estimated fee that was actually charged (in stroops). */
  feeCharged: string;
}

/** Fee and resource estimate for a transaction. */
export interface FeeEstimate {
  /** Recommended fee in stroops (includes a safety buffer). */
  fee: string;
  /** Soroban resource usage breakdown. */
  resources: {
    instructions: number;
    readBytes: number;
    writeBytes: number;
    readEntries: number;
    writeEntries: number;
  };
  /** Minimum resource fee in stroops (from simulation). */
  minResourceFee: string;
}
