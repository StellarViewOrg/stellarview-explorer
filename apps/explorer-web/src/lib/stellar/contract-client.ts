import {
  Contract,
  TransactionBuilder,
  Transaction,
  Account,
  Networks,
  xdr,
  rpc as StellarRpc,
} from "@stellar/stellar-sdk";
import { getRpcClient } from "@/lib/stellar/client";
import type { NetworkKey } from "@/types";
import { decodeResultNative } from "./spec-decoder";
import * as freighter from "@stellar/freighter-api";

export interface ReadCallResult {
  success: boolean;
  result?: unknown;
  resultXdr?: string;
  error?: string;
  rawError?: unknown;
}

export interface WriteSimulationResult {
  success: boolean;
  minFee?: string;
  cpuInstructions?: string;
  memoryBytes?: string;
  error?: string;
  rawError?: unknown;
}

export interface WriteExecutionResult {
  success: boolean;
  txHash?: string;
  result?: unknown;
  error?: string;
  rawError?: unknown;
}

export function getNetworkPassphrase(network: NetworkKey): string {
  switch (network) {
    case "mainnet":
      return Networks.PUBLIC;
    case "futurenet":
      return Networks.FUTURENET;
    case "testnet":
    default:
      return Networks.TESTNET;
  }
}

/**
 * Sanitize error message to prevent leaking raw contract panic or stack trace in UI.
 * Logs full detail to console for observability.
 */
export function sanitizeContractError(
  error: unknown,
  fallbackKey:
    | "simulationError"
    | "resourceEstimationError"
    | "submissionFailure"
    | "genericFailure" = "genericFailure"
): string {
  console.error("[Contract Console Observability]", error);

  if (!error) return fallbackKey;

  const msg =
    typeof error === "string" ? error : (error as { message?: string }).message || String(error);

  if (
    msg.includes("User declined") ||
    msg.includes("User rejected") ||
    msg.includes("Declined by user") ||
    msg.includes("Wallet") ||
    msg.includes("Freighter") ||
    msg.includes("TransactionFailed") ||
    msg.includes("txFailed")
  ) {
    return "submissionFailure";
  }

  if (
    msg.includes("ContractNotInvokable") ||
    msg.includes("HostError") ||
    msg.includes("ResourceLimitExceeded") ||
    msg.includes("BudgetExceeded")
  ) {
    return "simulationError";
  }

  return fallbackKey;
}

// Dummy source account for simulation when no wallet is connected
const SIMULATION_SOURCE_ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

/**
 * Simulate a read call on a contract via Stellar RPC (no wallet required).
 */
export async function simulateContractRead(
  network: NetworkKey,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[] = []
): Promise<ReadCallResult> {
  try {
    const rpc = getRpcClient(network);
    const passphrase = getNetworkPassphrase(network);

    const contract = new Contract(contractId);
    const callOp = contract.call(functionName, ...args);

    const sourceAccount = await rpc
      .getAccount(SIMULATION_SOURCE_ACCOUNT)
      .catch(() => new Account(SIMULATION_SOURCE_ACCOUNT, "1"));

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: passphrase,
    })
      .addOperation(callOp)
      .setTimeout(30)
      .build();

    const simRes = await rpc.simulateTransaction(tx);

    if (StellarRpc.Api.isSimulationError(simRes)) {
      return {
        success: false,
        error: sanitizeContractError(simRes.error, "simulationError"),
        rawError: simRes,
      };
    }

    if (!simRes.result || !simRes.result.retval) {
      return {
        success: true,
        result: null,
        resultXdr: undefined,
      };
    }

    const retval = simRes.result.retval;
    const nativeResult = decodeResultNative(retval);
    const resultXdr = retval.toXDR("base64");

    return {
      success: true,
      result: nativeResult,
      resultXdr,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: sanitizeContractError(err, "simulationError"),
      rawError: err,
    };
  }
}

/**
 * Simulate a write invocation for fee and resource estimation.
 */
export async function simulateContractWrite(
  network: NetworkKey,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[] = [],
  sourcePublicKey?: string
): Promise<WriteSimulationResult> {
  try {
    const rpc = getRpcClient(network);
    const passphrase = getNetworkPassphrase(network);
    const source = sourcePublicKey || SIMULATION_SOURCE_ACCOUNT;

    const contract = new Contract(contractId);
    const callOp = contract.call(functionName, ...args);

    const sourceAccount = await rpc.getAccount(source).catch(() => new Account(source, "1"));

    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase: passphrase,
    })
      .addOperation(callOp)
      .setTimeout(30)
      .build();

    const simRes = await rpc.simulateTransaction(tx);

    if (StellarRpc.Api.isSimulationError(simRes)) {
      return {
        success: false,
        error: sanitizeContractError(simRes.error, "resourceEstimationError"),
        rawError: simRes,
      };
    }

    const minFee = simRes.minResourceFee ? String(simRes.minResourceFee) : "100";
    let cpuInstructions: string | undefined;
    let memoryBytes: string | undefined;

    if (simRes.transactionData) {
      try {
        const rawData =
          typeof (simRes.transactionData as unknown as { build?: () => xdr.SorobanTransactionData })
            .build === "function"
            ? (
                simRes.transactionData as unknown as { build: () => xdr.SorobanTransactionData }
              ).build()
            : (simRes.transactionData as unknown as xdr.SorobanTransactionData);

        const resources = rawData.resources();
        cpuInstructions = String(resources.instructions());
        memoryBytes = String(resources.diskReadBytes());
      } catch {
        // ignore resource extraction error
      }
    }

    return {
      success: true,
      minFee,
      cpuInstructions,
      memoryBytes,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: sanitizeContractError(err, "resourceEstimationError"),
      rawError: err,
    };
  }
}

/**
 * Submit write transaction signed via Stellar Wallets Kit / Freighter API.
 */
export async function executeContractWrite(
  network: NetworkKey,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[] = [],
  publicKey: string
): Promise<WriteExecutionResult> {
  try {
    if (!publicKey) {
      return {
        success: false,
        error: "walletPublicKeyRequired",
      };
    }

    const rpc = getRpcClient(network);
    const passphrase = getNetworkPassphrase(network);

    const account = await rpc.getAccount(publicKey);
    const contract = new Contract(contractId);
    const callOp = contract.call(functionName, ...args);

    const tx = new TransactionBuilder(account, {
      fee: "1000",
      networkPassphrase: passphrase,
    })
      .addOperation(callOp)
      .setTimeout(60)
      .build();

    const preparedTx = await rpc.prepareTransaction(tx);

    const signedResult = await freighter.signTransaction(preparedTx.toXDR(), {
      networkPassphrase: passphrase,
    });

    const signedXdr =
      typeof signedResult === "string"
        ? signedResult
        : (signedResult as { signedTxXdr?: string })?.signedTxXdr;
    if (!signedXdr) {
      return {
        success: false,
        error: "walletSignFailed",
      };
    }

    const signedTx = new Transaction(signedXdr, passphrase);
    const sendRes = await rpc.sendTransaction(signedTx);

    if (sendRes.status === "ERROR") {
      return {
        success: false,
        error: sanitizeContractError(sendRes.errorResult, "submissionFailure"),
        rawError: sendRes,
      };
    }

    const txHash = sendRes.hash;

    let attempts = 0;
    while (attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
      const statusRes = await rpc.getTransaction(txHash);

      if (statusRes.status === StellarRpc.Api.GetTransactionStatus.SUCCESS) {
        let nativeResult = null;
        if (statusRes.returnValue) {
          nativeResult = decodeResultNative(statusRes.returnValue);
        }
        return {
          success: true,
          txHash,
          result: nativeResult,
        };
      }

      if (statusRes.status === StellarRpc.Api.GetTransactionStatus.FAILED) {
        return {
          success: false,
          txHash,
          error: sanitizeContractError(statusRes.resultXdr, "submissionFailure"),
          rawError: statusRes,
        };
      }
    }

    return {
      success: true,
      txHash,
      result: "Submitted (pending confirmation)",
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: sanitizeContractError(err, "submissionFailure"),
      rawError: err,
    };
  }
}
