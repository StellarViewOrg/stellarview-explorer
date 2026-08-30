// Frozen API contract types for the indexer's reproducible source verification
// service (indexer#36). The service is expected to ship a stub returning
// "unverified/no data" before the build pipeline is live, so the shapes below
// are what the explorer builds its full UI against — badge, source browser,
// diff view, and submission flow all render from these types regardless of
// whether the real build pipeline is running yet.

/** Outcome of a verification attempt, or the current record's state. */
export type VerificationStatus =
  | "verified"
  | "unverified"
  | "pending"
  | "mismatch"
  | "build_failed";

/** Toolchain metadata a submission was built with. */
export interface VerificationToolchain {
  rustVersion: string;
  sdkVersion: string;
}

/** Build optimization profile used to reproduce the WASM binary. */
export type VerificationBuildProfile = "release" | "release-with-logs";

/** One node in a verified contract's source file tree. */
export interface SourceTreeNode {
  path: string;
  type: "file" | "dir";
  children?: SourceTreeNode[];
}

/** Where a submission's source came from. */
export type VerificationSourceRef =
  | { type: "git"; repositoryUrl: string; commit: string }
  | { type: "archive"; archiveUrl: string };

/**
 * A verification record for one `wasm_hash`. Verifications are keyed by
 * `wasm_hash`, not contract ID, so identical bytecode deployed to multiple
 * contract IDs shares one record.
 */
export interface VerificationRecord {
  wasmHash: string;
  status: VerificationStatus;
  submittedAt: string;
  verifiedAt: string | null;
  submitter: string | null;
  toolchain: VerificationToolchain;
  buildProfile: VerificationBuildProfile;
  source: VerificationSourceRef | null;
  sourceTree: SourceTreeNode[];
  /** Present when status is "build_failed" or "mismatch". */
  failureReason: string | null;
  buildLogUrl: string | null;
}

/** Content of one verified source file. */
export interface SourceFileContent {
  path: string;
  content: string;
}

export interface VerificationSubmissionRequest {
  contractId: string;
  source: VerificationSourceRef;
  toolchain: VerificationToolchain;
  buildProfile: VerificationBuildProfile;
}

export interface VerificationSubmissionResult {
  submissionId: string;
  status: VerificationStatus;
}
