import { describe, it, expect } from "vitest";
import {
  Account,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { decodeTransactionEnvelope } from "./xdr-decoder";

function buildEnvelope(memo: Memo): string {
  const source = new Account(Keypair.random().publicKey(), "1");
  const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase: Networks.PUBLIC })
    .addOperation(Operation.bumpSequence({ bumpTo: "2" }))
    .addMemo(memo)
    .setTimeout(30)
    .build();
  return tx.toEnvelope().toXdr("base64");
}

describe("decodeTransactionEnvelope", () => {
  it("returns null for empty/undefined input", () => {
    expect(decodeTransactionEnvelope("")).toBeNull();
    expect(decodeTransactionEnvelope(undefined as unknown as string)).toBeNull();
  });

  it("returns null for invalid XDR", () => {
    expect(decodeTransactionEnvelope("not-valid-xdr")).toBeNull();
  });

  it("renders a hash memo as hex", () => {
    const hash = "ab".repeat(32);
    const decoded = decodeTransactionEnvelope(buildEnvelope(Memo.hash(hash)));
    expect(decoded?.memoType).toBe("hash");
    expect(decoded?.memo).toBe(hash);
  });

  it("renders an id memo as its decimal string", () => {
    const decoded = decodeTransactionEnvelope(buildEnvelope(Memo.id("12345")));
    expect(decoded?.memoType).toBe("id");
    expect(decoded?.memo).toBe("12345");
  });

  it("accepts network parameter", () => {
    expect(decodeTransactionEnvelope("", "testnet")).toBeNull();
    expect(decodeTransactionEnvelope("", "futurenet")).toBeNull();
  });
});
