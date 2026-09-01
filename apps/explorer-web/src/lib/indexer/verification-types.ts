// API contract types for the indexer's reproducible source verification
// service, matching the frozen surface shipped in indexer#48:
// - GET  /v1/verify/wasm/{wasmHash}
// - GET  /v1/verify/wasm/{wasmHash}/source
// - GET  /v1/verify/wasm/{wasmHash}/source/{path...}
// - POST /v1/verify
//
// The sandboxed build pipeline that actually reproduces a build and compares
// wasm hashes is still out of scope on the indexer (tracked separately): every
// submission stays in "pending" for now, and the explorer must treat that as
// "not yet verified", not as a mismatch.

/** Outcome of a verification attempt, or the current record's state. */
export type VerificationStatus = "unverified" | "pending" | "verified" | "mismatch" | "failed";

/** One file in a verified contract's source tree (no nesting - a flat list of paths). */
export interface SourceFileMeta {
  path: string;
  bytes: number;
}

/**
 * A verification record for one `wasm_hash`. Verifications are keyed by
 * `wasm_hash`, not contract ID, so identical bytecode deployed to multiple
 * contract IDs shares one record.
 */
export interface VerificationRecord {
  id: number;
  wasmHash: string;
  contractId: string;
  network: string;
  repositoryUrl: string | null;
  gitRef: string | null;
  gitCommit: string | null;
  rustVersion: string | null;
  sorobanSdkVersion: string | null;
  status: VerificationStatus;
  computedWasmHash: string | null;
  failureReason: string | null;
  submittedAt: string;
  completedAt: string | null;
}

/** Content of one verified source file. */
export interface SourceFileContent {
  wasmHash: string;
  path: string;
  content: string;
  bytes: number;
}

export interface VerificationSubmissionRequest {
  contractId: string;
  network: string;
  repositoryUrl?: string;
  gitRef?: string;
  gitCommit?: string;
  rustVersion?: string;
  sorobanSdkVersion?: string;
  /** path -> full source content of that file. At least one entry is required. */
  files: Record<string, string>;
}
