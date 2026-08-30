import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchVerificationStatus,
  fetchVerificationSourceFile,
  submitVerification,
  fetchVerificationSubmission,
} from "./verification";
import type { VerificationRecord } from "./verification-types";

const WASM_HASH = "a".repeat(64);

const RECORD: VerificationRecord = {
  wasmHash: WASM_HASH,
  status: "verified",
  submittedAt: "2026-01-01T00:00:00Z",
  verifiedAt: "2026-01-01T00:05:00Z",
  submitter: "GA62IQXVM62EIMLR2Z63L3V2HLBF2RPCSXTQKPEHEGTR6ARVYW4SUKLF",
  toolchain: { rustVersion: "1.79.0", sdkVersion: "21.0.0" },
  buildProfile: "release",
  source: { type: "git", repositoryUrl: "https://example.com/repo", commit: "abc123" },
  sourceTree: [{ path: "src/lib.rs", type: "file" }],
  failureReason: null,
  buildLogUrl: null,
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

  it("treats a null record as an available, unverified answer", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse({ verified: false, record: null });

    await expect(fetchVerificationStatus(WASM_HASH)).resolves.toEqual({
      available: true,
      data: null,
    });
  });

  it("returns the verification record when verified", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse({ verified: true, record: RECORD });

    await expect(fetchVerificationStatus(WASM_HASH)).resolves.toEqual({
      available: true,
      data: RECORD,
    });
  });

  it("fetches source file content", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse({ path: "src/lib.rs", content: "pub fn main() {}" });

    await expect(fetchVerificationSourceFile(WASM_HASH, "src/lib.rs")).resolves.toEqual({
      available: true,
      data: { path: "src/lib.rs", content: "pub fn main() {}" },
    });
  });

  it("submits a verification request", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse({ submissionId: "sub_1", status: "pending" });

    const result = await submitVerification({
      contractId: "C".padEnd(56, "A"),
      source: { type: "git", repositoryUrl: "https://example.com/repo", commit: "abc123" },
      toolchain: { rustVersion: "1.79.0", sdkVersion: "21.0.0" },
      buildProfile: "release",
    });

    expect(result).toEqual({ available: true, data: { submissionId: "sub_1", status: "pending" } });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://indexer/v1/verification",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("polls submission status", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse(RECORD);

    await expect(fetchVerificationSubmission("sub_1")).resolves.toEqual({
      available: true,
      data: RECORD,
    });
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
