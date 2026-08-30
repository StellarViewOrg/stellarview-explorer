import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getNetworkPassphrase,
  sanitizeContractError,
  simulateContractRead,
  simulateContractWrite,
  executeContractWrite,
} from "./contract-client";
import { getRpcClient } from "@/lib/stellar/client";
import * as freighter from "@stellar/freighter-api";
import { Account } from "@stellar/stellar-sdk";
import { decodeResultNative } from "./spec-decoder";

// Mock the client file
vi.mock("@/lib/stellar/client", () => {
  return {
    getRpcClient: vi.fn(),
  };
});

// Mock Freighter
vi.mock("@stellar/freighter-api", () => {
  return {
    signTransaction: vi.fn(),
    isConnected: vi.fn(),
    requestAccess: vi.fn(),
    getAddress: vi.fn(),
  };
});

// Mock Spec Decoder (both relative and alias) in a hoisting-safe manner
vi.mock("./spec-decoder", () => {
  return {
    decodeResultNative: vi.fn(),
    decodeContractSpec: vi.fn(),
    encodeInputToScVal: vi.fn(),
  };
});

vi.mock("@/lib/stellar/spec-decoder", () => {
  return {
    decodeResultNative: vi.fn(),
    decodeContractSpec: vi.fn(),
    encodeInputToScVal: vi.fn(),
  };
});

// Use a valid 56-character base32 contract ID to pass Stellar SDK validation
const VALID_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const DUMMY_PUBLIC_KEY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

describe("contract-client", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(decodeResultNative).mockReturnValue("mocked-decoded-result");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getNetworkPassphrase", () => {
    it("returns correct network passphrases", () => {
      expect(getNetworkPassphrase("mainnet")).toContain("Public");
      expect(getNetworkPassphrase("testnet")).toContain("Test");
      expect(getNetworkPassphrase("futurenet")).toContain("Future");
    });

    it("defaults to testnet for unknown network", () => {
      expect(getNetworkPassphrase("unknown" as never)).toContain("Test");
    });
  });

  describe("sanitizeContractError", () => {
    it("returns submissionFailure for wallet rejections", () => {
      expect(sanitizeContractError("User declined request")).toBe("submissionFailure");
      expect(sanitizeContractError("User rejected the transaction")).toBe("submissionFailure");
      expect(sanitizeContractError("Declined by user")).toBe("submissionFailure");
    });

    it("returns simulationError for contract invocation errors", () => {
      expect(sanitizeContractError("HostError: ContractNotInvokable")).toBe("simulationError");
      expect(sanitizeContractError("HostError in contract")).toBe("simulationError");
    });

    it("returns simulationError for resource limit errors", () => {
      expect(sanitizeContractError("ResourceLimitExceeded in VM")).toBe("simulationError");
      expect(sanitizeContractError("BudgetExceeded during execution")).toBe("simulationError");
    });

    it("returns submissionFailure for transaction failed errors on chain", () => {
      expect(sanitizeContractError("TransactionFailed on chain")).toBe("submissionFailure");
      expect(sanitizeContractError("txFailed in ledger")).toBe("submissionFailure");
    });

    it("returns submissionFailure for wallet-related errors", () => {
      expect(sanitizeContractError("Wallet not connected")).toBe("submissionFailure");
      expect(sanitizeContractError("Freighter timeout")).toBe("submissionFailure");
    });

    it("returns fallback key for unknown errors without appending msg details", () => {
      expect(sanitizeContractError("Random internal error 123", "genericFailure")).toBe(
        "genericFailure"
      );
      expect(sanitizeContractError("HostError: Something went wrong", "genericFailure")).toBe(
        "simulationError"
      ); // still catches recognized patterns
      expect(sanitizeContractError("Totally unknown error text", "genericFailure")).toBe(
        "genericFailure"
      );
    });

    it("ensures raw HostError/stack trace strings do not appear in the returned message", () => {
      const rawErrorMsg =
        "HostError: Error(Value(Error(Context(Instruction(12)))))\nstack backtrace:\n   0: std::panicking::begin_panic";
      const result = sanitizeContractError(rawErrorMsg, "genericFailure");

      expect(result).toBe("simulationError");
      expect(result).not.toContain("stack backtrace");
      expect(result).not.toContain("Instruction");
      expect(result).not.toContain("Value");
    });

    it("handles null, undefined, and boolean errors gracefully returning the fallbackKey", () => {
      expect(sanitizeContractError(null, "genericFailure")).toBe("genericFailure");
      expect(sanitizeContractError(undefined, "genericFailure")).toBe("genericFailure");
      expect(sanitizeContractError(false, "genericFailure")).toBe("genericFailure");
    });
  });

  describe("simulateContractRead", () => {
    it("returns parsed result on successful simulation", async () => {
      const mockAccount = new Account(DUMMY_PUBLIC_KEY, "1");
      const mockRetval = {
        toXDR: () => "dummyScValBase64",
      };

      vi.mocked(getRpcClient).mockReturnValue({
        getAccount: vi.fn().mockResolvedValue(mockAccount),
        simulateTransaction: vi.fn().mockResolvedValue({
          result: {
            retval: mockRetval,
          },
        }),
      } as never);

      const res = await simulateContractRead("testnet", VALID_CONTRACT_ID, "my_func", []);
      expect(res.success).toBe(true);
      expect(res.result).toBe("mocked-decoded-result");
      expect(res.resultXdr).toBe("dummyScValBase64");
    });

    it("returns simulationError on simulation error response", async () => {
      const mockAccount = new Account(DUMMY_PUBLIC_KEY, "1");
      vi.mocked(getRpcClient).mockReturnValue({
        getAccount: vi.fn().mockResolvedValue(mockAccount),
        simulateTransaction: vi.fn().mockResolvedValue({
          error: "HostError: ContractNotInvokable",
        }),
      } as never);

      const res = await simulateContractRead("testnet", VALID_CONTRACT_ID, "my_func", []);
      expect(res.success).toBe(false);
      expect(res.error).toBe("simulationError");
    });

    it("returns simulationError on client network crash/throw", async () => {
      vi.mocked(getRpcClient).mockReturnValue({
        getAccount: vi.fn().mockRejectedValue(new Error("Network connection lost")),
      } as never);

      const res = await simulateContractRead("testnet", VALID_CONTRACT_ID, "my_func", []);
      expect(res.success).toBe(false);
      expect(res.error).toBe("simulationError");
    });
  });

  describe("simulateContractWrite", () => {
    it("returns estimated resources on successful simulation", async () => {
      const mockAccount = new Account(DUMMY_PUBLIC_KEY, "1");
      const mockResources = {
        instructions: () => 10000,
        diskReadBytes: () => 2000,
      };
      const mockTransactionData = {
        resources: () => mockResources,
      };

      vi.mocked(getRpcClient).mockReturnValue({
        getAccount: vi.fn().mockResolvedValue(mockAccount),
        simulateTransaction: vi.fn().mockResolvedValue({
          minResourceFee: 150,
          transactionData: mockTransactionData,
        }),
      } as never);

      const res = await simulateContractWrite("testnet", VALID_CONTRACT_ID, "my_write_func", []);
      expect(res.success).toBe(true);
      expect(res.minFee).toBe("150");
      expect(res.cpuInstructions).toBe("10000");
      expect(res.memoryBytes).toBe("2000");
    });

    it("returns resourceEstimationError on simulation error response", async () => {
      const mockAccount = new Account(DUMMY_PUBLIC_KEY, "1");
      vi.mocked(getRpcClient).mockReturnValue({
        getAccount: vi.fn().mockResolvedValue(mockAccount),
        simulateTransaction: vi.fn().mockResolvedValue({
          error: "BudgetExceeded during write simulation",
        }),
      } as never);

      const res = await simulateContractWrite("testnet", VALID_CONTRACT_ID, "my_write_func", []);
      expect(res.success).toBe(false);
      expect(res.error).toBe("simulationError"); // mapped from BudgetExceeded pattern
    });

    it("returns resourceEstimationError on client network exception", async () => {
      vi.mocked(getRpcClient).mockReturnValue({
        getAccount: vi.fn().mockRejectedValue(new Error("RPC Timeout")),
      } as never);

      const res = await simulateContractWrite("testnet", VALID_CONTRACT_ID, "my_write_func", []);
      expect(res.success).toBe(false);
      expect(res.error).toBe("resourceEstimationError");
    });
  });

  describe("executeContractWrite", () => {
    it("returns error immediately when public key is missing", async () => {
      const res = await executeContractWrite("testnet", VALID_CONTRACT_ID, "my_write", [], "");
      expect(res.success).toBe(false);
      expect(res.error).toBe("walletPublicKeyRequired");
    });

    it("returns success when transaction is prepared, signed, and successfully confirmed", async () => {
      const mockAccount = new Account(DUMMY_PUBLIC_KEY, "1");

      vi.mocked(getRpcClient).mockReturnValue({
        getAccount: vi.fn().mockResolvedValue(mockAccount),
        prepareTransaction: vi.fn().mockImplementation((tx) => tx),
        sendTransaction: vi.fn().mockResolvedValue({
          status: "PENDING",
          hash: "txhash12345",
        }),
        getTransaction: vi.fn().mockResolvedValue({
          status: "SUCCESS",
          returnValue: "dummyScVal",
        }),
      } as never);

      vi.mocked(freighter.signTransaction).mockImplementation((xdr) => Promise.resolve(xdr));

      const writePromise = executeContractWrite(
        "testnet",
        VALID_CONTRACT_ID,
        "my_write",
        [],
        DUMMY_PUBLIC_KEY
      );

      // Advance fake timers by 2 seconds to trigger the loop wait quickly
      await vi.advanceTimersByTimeAsync(2000);

      const res = await writePromise;
      expect(res.success).toBe(true);
      expect(res.txHash).toBe("txhash12345");
      expect(res.result).toBe("mocked-decoded-result");
    });

    it("returns submissionFailure when Freighter wallet rejected the signing request", async () => {
      const mockAccount = new Account(DUMMY_PUBLIC_KEY, "1");

      vi.mocked(getRpcClient).mockReturnValue({
        getAccount: vi.fn().mockResolvedValue(mockAccount),
        prepareTransaction: vi.fn().mockImplementation((tx) => tx),
      } as never);

      vi.mocked(freighter.signTransaction).mockRejectedValue(new Error("User declined signing"));

      const res = await executeContractWrite(
        "testnet",
        VALID_CONTRACT_ID,
        "my_write",
        [],
        DUMMY_PUBLIC_KEY
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("submissionFailure");
    });

    it("returns submissionFailure when RPC transaction submission fails", async () => {
      const mockAccount = new Account(DUMMY_PUBLIC_KEY, "1");

      vi.mocked(getRpcClient).mockReturnValue({
        getAccount: vi.fn().mockResolvedValue(mockAccount),
        prepareTransaction: vi.fn().mockImplementation((tx) => tx),
        sendTransaction: vi.fn().mockResolvedValue({
          status: "ERROR",
          errorResult: "txFailed: bad fee",
        }),
      } as never);

      vi.mocked(freighter.signTransaction).mockImplementation((xdr) => Promise.resolve(xdr));

      const res = await executeContractWrite(
        "testnet",
        VALID_CONTRACT_ID,
        "my_write",
        [],
        DUMMY_PUBLIC_KEY
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe("submissionFailure");
    });

    it("returns submissionFailure when getTransaction returns FAILED status", async () => {
      const mockAccount = new Account(DUMMY_PUBLIC_KEY, "1");

      vi.mocked(getRpcClient).mockReturnValue({
        getAccount: vi.fn().mockResolvedValue(mockAccount),
        prepareTransaction: vi.fn().mockImplementation((tx) => tx),
        sendTransaction: vi.fn().mockResolvedValue({
          status: "PENDING",
          hash: "txhash12345",
        }),
        getTransaction: vi.fn().mockResolvedValue({
          status: "FAILED",
          resultXdr: "txFailed: execution reverted",
        }),
      } as never);

      vi.mocked(freighter.signTransaction).mockImplementation((xdr) => Promise.resolve(xdr));

      const writePromise = executeContractWrite(
        "testnet",
        VALID_CONTRACT_ID,
        "my_write",
        [],
        DUMMY_PUBLIC_KEY
      );

      await vi.advanceTimersByTimeAsync(2000);

      const res = await writePromise;
      expect(res.success).toBe(false);
      expect(res.error).toBe("submissionFailure");
    });
  });
});
