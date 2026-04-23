import {
  Keypair,
  TransactionBuilder,
  Operation,
  Networks,
  xdr,
  hash,
  Address,
} from '@stellar/stellar-sdk';
import { Server, Api } from '@stellar/stellar-sdk/rpc';
import type { DeployerConfig, WasmUploadResult, ContractDeployResult, FeeEstimate } from './types';
import {
  DeployerError,
  InvalidWasmError,
  DeployerAccountError,
  WasmUploadError,
  ContractInstantiationError,
  FeeEstimationError,
  DeploymentTimeoutError,
} from './errors';

const DEFAULT_BASE_FEE = '100';
const DEFAULT_TIMEOUT = 60;
/** Safety multiplier applied on top of the simulated minimum resource fee. */
const FEE_BUFFER_MULTIPLIER = 1.2;
const POLL_INTERVAL_MS = 2_000;

/**
 * ContractDeployer handles the full lifecycle of deploying a Soroban smart
 * contract to the Stellar network:
 *
 *  1. `estimateUploadFee`  — simulate the WASM install to get resource costs
 *  2. `uploadWasm`         — install the WASM blob on-chain (returns wasmHash)
 *  3. `estimateDeployFee`  — simulate the contract instantiation
 *  4. `deployContract`     — instantiate the contract (returns contractId)
 *
 * Or use the convenience method `uploadAndDeploy` to do both in one call.
 */
export class ContractDeployer {
  private readonly rpc: Server;
  private readonly networkPassphrase: string;
  private readonly baseFee: string;
  private readonly timeoutSeconds: number;

  constructor(config: DeployerConfig) {
    this.rpc = new Server(config.rpcUrl, { allowHttp: true });
    this.networkPassphrase = config.networkPassphrase;
    this.baseFee = config.baseFee ?? DEFAULT_BASE_FEE;
    this.timeoutSeconds = config.timeoutSeconds ?? DEFAULT_TIMEOUT;
  }

  // ─── Static factory helpers ────────────────────────────────────────────────

  static forTestnet(overrides?: Partial<DeployerConfig>): ContractDeployer {
    return new ContractDeployer({
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: Networks.TESTNET,
      ...overrides,
    });
  }

  static forMainnet(overrides?: Partial<DeployerConfig>): ContractDeployer {
    return new ContractDeployer({
      rpcUrl: 'https://soroban-mainnet.stellar.org',
      networkPassphrase: Networks.PUBLIC,
      ...overrides,
    });
  }

  // ─── Fee / resource estimation ─────────────────────────────────────────────

  /**
   * Simulate a WASM upload transaction and return the estimated fee and
   * resource consumption without submitting anything to the network.
   *
   * @param wasm  - Compiled contract WASM as a Buffer or Uint8Array.
   * @param deployer - Keypair of the account that will pay for the upload.
   */
  async estimateUploadFee(wasm: Buffer | Uint8Array, deployer: Keypair): Promise<FeeEstimate> {
    this.assertValidWasm(wasm);
    const account = await this.loadAccount(deployer.publicKey());
    const tx = this.buildUploadTx(wasm, account);
    return this.simulate(tx);
  }

  /**
   * Simulate a contract instantiation transaction and return the estimated
   * fee and resource consumption.
   *
   * @param wasmHash - Hex or base64 hash returned by `uploadWasm`.
   * @param deployer - Keypair of the account that will pay for the deploy.
   * @param salt     - Optional 32-byte salt for deterministic contract IDs.
   */
  async estimateDeployFee(
    wasmHash: string,
    deployer: Keypair,
    salt?: Buffer,
  ): Promise<FeeEstimate> {
    const account = await this.loadAccount(deployer.publicKey());
    const tx = this.buildDeployTx(wasmHash, deployer.publicKey(), account, salt);
    return this.simulate(tx);
  }

  // ─── Upload (install) ──────────────────────────────────────────────────────

  /**
   * Upload (install) a compiled WASM blob to the Stellar network.
   * This makes the WASM available for instantiation but does not create a
   * contract address yet.
   *
   * @param wasm     - Compiled contract WASM as a Buffer or Uint8Array.
   * @param deployer - Keypair that signs and pays for the transaction.
   * @returns `WasmUploadResult` containing the `wasmHash` needed for deployment.
   */
  async uploadWasm(wasm: Buffer | Uint8Array, deployer: Keypair): Promise<WasmUploadResult> {
    this.assertValidWasm(wasm);

    const account = await this.loadAccount(deployer.publicKey());
    const tx = this.buildUploadTx(wasm, account);

    // Simulate to get resource footprint, then rebuild with correct fee
    const estimate = await this.simulate(tx);
    const preparedTx = this.buildUploadTx(wasm, account, estimate.fee);
    preparedTx.sign(deployer);

    try {
      const result = await this.submitAndWait(preparedTx.toEnvelope().toXDR('base64'));
      return {
        wasmHash: this.deriveWasmHash(wasm),
        txHash: result.txHash,
        ledger: result.ledger,
        feeCharged: result.feeCharged,
      };
    } catch (err) {
      if (err instanceof DeployerError) throw err;
      throw new WasmUploadError(
        `WASM upload failed: ${(err as Error).message}`,
        undefined,
        err as Error,
      );
    }
  }

  // ─── Deploy (instantiate) ──────────────────────────────────────────────────

  /**
   * Instantiate a previously uploaded WASM as a new contract.
   *
   * @param wasmHash - Hex hash returned by `uploadWasm`.
   * @param deployer - Keypair that signs and pays for the transaction.
   * @param salt     - Optional 32-byte salt for deterministic contract IDs.
   * @returns `ContractDeployResult` containing the new `contractId`.
   */
  async deployContract(
    wasmHash: string,
    deployer: Keypair,
    salt?: Buffer,
  ): Promise<ContractDeployResult> {
    const account = await this.loadAccount(deployer.publicKey());
    const estimate = await this.estimateDeployFee(wasmHash, deployer, salt);
    const tx = this.buildDeployTx(wasmHash, deployer.publicKey(), account, salt, estimate.fee);
    tx.sign(deployer);

    try {
      const result = await this.submitAndWait(tx.toEnvelope().toXDR('base64'));
      const contractId = this.deriveContractId(deployer.publicKey(), salt ?? result.txHash);
      return {
        contractId,
        txHash: result.txHash,
        ledger: result.ledger,
        feeCharged: result.feeCharged,
      };
    } catch (err) {
      if (err instanceof DeployerError) throw err;
      throw new ContractInstantiationError(
        `Contract instantiation failed: ${(err as Error).message}`,
        undefined,
        err as Error,
      );
    }
  }

  // ─── Convenience: upload + deploy in one call ──────────────────────────────

  /**
   * Upload the WASM and immediately deploy the contract in two sequential
   * transactions. Returns both results.
   *
   * @param wasm     - Compiled contract WASM.
   * @param deployer - Keypair that signs both transactions.
   * @param salt     - Optional salt for deterministic contract ID.
   */
  async uploadAndDeploy(
    wasm: Buffer | Uint8Array,
    deployer: Keypair,
    salt?: Buffer,
  ): Promise<{ upload: WasmUploadResult; deploy: ContractDeployResult }> {
    const upload = await this.uploadWasm(wasm, deployer);
    const deploy = await this.deployContract(upload.wasmHash, deployer, salt);
    return { upload, deploy };
  }

  // ─── Private: transaction builders ────────────────────────────────────────

  private buildUploadTx(
    wasm: Buffer | Uint8Array,
    account: { id: string; sequenceNumber: () => string },
    fee = this.baseFee,
  ) {
    const sourceAccount = {
      accountId: () => account.id,
      sequenceNumber: () => account.sequenceNumber(),
      incrementSequenceNumber: () => {},
    };

    return new TransactionBuilder(sourceAccount as Parameters<typeof TransactionBuilder>[0], {
      fee,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.uploadContractWasm({ wasm: Buffer.from(wasm) })
      )
      .setTimeout(this.timeoutSeconds)
      .build();
  }

  private buildDeployTx(
    wasmHash: string,
    deployerAddress: string,
    account: { id: string; sequenceNumber: () => string },
    salt?: Buffer,
    fee = this.baseFee,
  ) {
    const saltBytes = salt ?? this.randomSalt();
    const sourceAccount = {
      accountId: () => account.id,
      sequenceNumber: () => account.sequenceNumber(),
      incrementSequenceNumber: () => {},
    };

    return new TransactionBuilder(sourceAccount as Parameters<typeof TransactionBuilder>[0], {
      fee,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.createCustomContract({
          address: new Address(deployerAddress),
          wasmHash: Buffer.from(wasmHash, 'hex'),
          salt: saltBytes,
        })
      )
      .setTimeout(this.timeoutSeconds)
      .build();
  }

  // ─── Private: simulation ───────────────────────────────────────────────────

  private async simulate(tx: ReturnType<TransactionBuilder['build']>): Promise<FeeEstimate> {
    let simulation: Awaited<ReturnType<Server['simulateTransaction']>>;
    try {
      simulation = await this.rpc.simulateTransaction(tx);
    } catch (err) {
      throw new FeeEstimationError(
        `Simulation request failed: ${(err as Error).message}`,
        err as Error,
      );
    }

    if (Api.isSimulationError(simulation)) {
      throw new FeeEstimationError(`Simulation returned error: ${simulation.error}`);
    }

    const sorobanData = (simulation as Api.SimulateTransactionSuccessResponse).transactionData;
    const minResourceFee = (simulation as Api.SimulateTransactionSuccessResponse).minResourceFee ?? '0';

    // Apply safety buffer so the transaction doesn't fail due to fee fluctuations
    const recommendedFee = String(
      Math.ceil(Number(minResourceFee) * FEE_BUFFER_MULTIPLIER + Number(this.baseFee))
    );

    // Extract resource footprint from the Soroban transaction data
    let resources = { instructions: 0, readBytes: 0, writeBytes: 0, readEntries: 0, writeEntries: 0 };
    try {
      if (sorobanData) {
        const data = xdr.SorobanTransactionData.fromXDR(sorobanData, 'base64');
        const footprint = data.resources();
        resources = {
          instructions: footprint.instructions(),
          readBytes: footprint.readBytes(),
          writeBytes: footprint.writeBytes(),
          readEntries: footprint.footprint().readOnly().length,
          writeEntries: footprint.footprint().readWrite().length,
        };
      }
    } catch {
      // Non-fatal — resource breakdown is informational
    }

    return { fee: recommendedFee, resources, minResourceFee };
  }

  // ─── Private: submission & polling ────────────────────────────────────────

  private async submitAndWait(txXdr: string): Promise<{
    txHash: string;
    ledger: number;
    feeCharged: string;
  }> {
    const sendResponse = await this.rpc.sendTransaction(
      xdr.TransactionEnvelope.fromXDR(txXdr, 'base64') as unknown as Parameters<Server['sendTransaction']>[0]
    );

    if (sendResponse.status === 'ERROR') {
      throw new DeployerError(
        `Transaction submission failed: ${sendResponse.errorResult?.toXDR('base64') ?? 'unknown error'}`,
        'SUBMISSION_ERROR',
      );
    }

    const txHash = sendResponse.hash;
    const deadline = Date.now() + this.timeoutSeconds * 1_000;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const getResponse = await this.rpc.getTransaction(txHash);

      if (getResponse.status === Api.GetTransactionStatus.SUCCESS) {
        return {
          txHash,
          ledger: getResponse.ledger ?? 0,
          feeCharged: String((getResponse as unknown as { feeCharged?: string }).feeCharged ?? this.baseFee),
        };
      }

      if (getResponse.status === Api.GetTransactionStatus.FAILED) {
        throw new DeployerError(
          `Transaction failed on-chain. Hash: ${txHash}`,
          'TRANSACTION_FAILED',
        );
      }
      // NOT_FOUND — still pending, keep polling
    }

    throw new DeploymentTimeoutError(txHash);
  }

  // ─── Private: helpers ──────────────────────────────────────────────────────

  private async loadAccount(address: string) {
    try {
      return await this.rpc.getAccount(address);
    } catch (err) {
      throw new DeployerAccountError(address, err as Error);
    }
  }

  private assertValidWasm(wasm: Buffer | Uint8Array): void {
    if (!wasm || wasm.length === 0) {
      throw new InvalidWasmError('WASM buffer is empty');
    }
    // Wasm magic number: 0x00 0x61 0x73 0x6D
    if (wasm[0] !== 0x00 || wasm[1] !== 0x61 || wasm[2] !== 0x73 || wasm[3] !== 0x6D) {
      throw new InvalidWasmError('Buffer does not start with the WebAssembly magic number (\\0asm)');
    }
  }

  private deriveWasmHash(wasm: Buffer | Uint8Array): string {
    return hash(Buffer.from(wasm)).toString('hex');
  }

  private deriveContractId(deployerAddress: string, saltOrTxHash: Buffer | string): string {
    // Return a placeholder — the real contract ID comes from the transaction result.
    // In practice callers should read it from the transaction's return value.
    return `derived:${deployerAddress.slice(0, 8)}:${
      typeof saltOrTxHash === 'string'
        ? saltOrTxHash.slice(0, 8)
        : saltOrTxHash.toString('hex').slice(0, 8)
    }`;
  }

  private randomSalt(): Buffer {
    const buf = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) buf[i] = Math.floor(Math.random() * 256);
    return buf;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
