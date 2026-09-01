import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchVerificationStatus,
  fetchVerificationSourceTree,
  fetchVerificationSourceFile,
  submitVerification,
} from "./verification";
import type { VerificationRecord } from "./verification-types";

const WASM_HASH = "a".repeat(64);

const RECORD: VerificationRecord = {
  id: 1,
  wasmHash: WASM_HASH,
  contractId: "C".padEnd(56, "A"),
  network: "testnet",
  repositoryUrl: "https://example.com/repo",
  gitRef: "main",
  gitCommit: "abc123",
  rustVersion: "1.79.0",
  sorobanSdkVersion: "21.0.0",
  status: "pending",
  computedWasmHash: null,
  failureReason: null,
  submittedAt: "2026-01-01T00:00:00.000Z",
  completedAt: null,
};

function mockResponse(body: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });
}

describe("indexer/verification", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns not_configured when the indexer URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "");

    await expect(fetchVerificationStatus(WASM_HASH)).resolves.toEqual({
      available: false,
      reason: "not_configured",
    });
  });

  it("returns error when the indexer responds with a non-ok status", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse({}, false);

    await expect(fetchVerificationStatus(WASM_HASH)).resolves.toEqual({
      available: false,
      reason: "error",
    });
  });

  it("treats a { verified: false } response as an available, unverified answer", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse({ wasmHash: WASM_HASH, verified: false, status: "unverified" });

    await expect(fetchVerificationStatus(WASM_HASH)).resolves.toEqual({
      available: true,
      data: null,
    });
  });

  it("returns the verification record when one exists", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse(RECORD);

    await expect(fetchVerificationStatus(WASM_HASH)).resolves.toEqual({
      available: true,
      data: RECORD,
    });
  });

  it("fetches the source file tree", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse({ wasmHash: WASM_HASH, files: [{ path: "src/lib.rs", bytes: 17 }] });

    await expect(fetchVerificationSourceTree(WASM_HASH)).resolves.toEqual({
      available: true,
      data: [{ path: "src/lib.rs", bytes: 17 }],
    });
  });

  it("fetches source file content from a path segment", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse({
      wasmHash: WASM_HASH,
      path: "src/lib.rs",
      content: "pub fn main() {}",
      bytes: 17,
    });

    await expect(fetchVerificationSourceFile(WASM_HASH, "src/lib.rs")).resolves.toEqual({
      available: true,
      data: { wasmHash: WASM_HASH, path: "src/lib.rs", content: "pub fn main() {}", bytes: 17 },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://indexer/v1/verify/wasm/" + WASM_HASH + "/source/src/lib.rs",
      expect.anything()
    );
  });

  it("submits a verification request with source file contents", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse(RECORD);

    const result = await submitVerification({
      contractId: "C".padEnd(56, "A"),
      network: "testnet",
      repositoryUrl: "https://example.com/repo",
      gitRef: "main",
      gitCommit: "abc123",
      rustVersion: "1.79.0",
      sorobanSdkVersion: "21.0.0",
      files: { "src/lib.rs": "pub fn main() {}" },
    });

    expect(result).toEqual({ available: true, data: RECORD });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://indexer/v1/verify",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns error when fetch throws", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(fetchVerificationStatus(WASM_HASH)).resolves.toEqual({
      available: false,
      reason: "error",
    });
  });
});
