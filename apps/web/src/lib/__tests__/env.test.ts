import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Environment Variable Validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to clear cached env validation
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should throw error when required contract IDs are missing", () => {
    delete process.env.NEXT_PUBLIC_PAYMENT_STREAM_CONTRACT_ID;
    delete process.env.NEXT_PUBLIC_DISTRIBUTOR_CONTRACT_ID;

    expect(() => {
      // Dynamic import to trigger validation
      require("../env");
    }).toThrow(/Environment variable validation failed/);
  });

  it("should throw error when contract IDs don't start with C", () => {
    process.env.NEXT_PUBLIC_PAYMENT_STREAM_CONTRACT_ID = "INVALID123";
    process.env.NEXT_PUBLIC_DISTRIBUTOR_CONTRACT_ID = "CVALID123";

    expect(() => {
      require("../env");
    }).toThrow(/Contract ID must start with 'C'/);
  });

  it("should throw error when network is invalid", () => {
    process.env.NEXT_PUBLIC_PAYMENT_STREAM_CONTRACT_ID = "CVALID123";
    process.env.NEXT_PUBLIC_DISTRIBUTOR_CONTRACT_ID = "CVALID456";
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "invalid";

    expect(() => {
      require("../env");
    }).toThrow(/Network must be either 'testnet' or 'mainnet'/);
  });

  it("should accept valid environment variables", () => {
    process.env.NEXT_PUBLIC_PAYMENT_STREAM_CONTRACT_ID = "CVALID123";
    process.env.NEXT_PUBLIC_DISTRIBUTOR_CONTRACT_ID = "CVALID456";
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

    expect(() => {
      require("../env");
    }).not.toThrow();
  });

  it("should use default values for optional variables", () => {
    process.env.NEXT_PUBLIC_PAYMENT_STREAM_CONTRACT_ID = "CVALID123";
    process.env.NEXT_PUBLIC_DISTRIBUTOR_CONTRACT_ID = "CVALID456";
    // Don't set optional variables

    expect(() => {
      require("../env");
    }).not.toThrow();
  });
});
