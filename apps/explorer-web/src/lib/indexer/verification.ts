import type {
  VerificationRecord,
  SourceFileMeta,
  SourceFileContent,
  VerificationSubmissionRequest,
} from "./verification-types";
import type { IndexerResult } from "./types";

/**
 * Client for the indexer's reproducible source verification API, matching
 * the frozen contract shipped in indexer#48 (`GET /v1/verify/wasm/{hash}`,
 * `.../source`, `.../source/{path...}`, `POST /v1/verify`).
 *
 * Like the domains API, availability of the *service* and availability of a
 * *record* are different things: a `not_configured`/`error` result means the
 * indexer isn't reachable at all, while a successful response reporting
 * `verified: false` (no submission yet) is a legitimate "not verified"
 * answer that must render as an unverified badge, not an error.
 *
 * The indexer's sandboxed build pipeline hasn't shipped yet: every
 * submission is recorded and stays in `status: "pending"` until it does. The
 * UI must treat `"pending"` as "not yet verified", not as a mismatch.
 */

const VERIFY_PATH = "/v1/verify";
const REQUEST_TIMEOUT_MS = 15_000;
const SUBMIT_TIMEOUT_MS = 30_000;

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_INDEXER_URL?.replace(/\/+$/, "") ?? "";
}

interface UnverifiedLookupResponse {
  wasmHash: string;
  verified: false;
  status: "unverified";
}

type VerificationLookupResponse = UnverifiedLookupResponse | VerificationRecord;

async function fetchVerificationJson<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number
): Promise<IndexerResult<T>> {
  const base = getBaseUrl();
  if (!base) {
    return { available: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return { available: false, reason: "error" };
    }

    const body = (await response.json()) as T;
    return { available: true, data: body };
  } catch {
    return { available: false, reason: "error" };
  }
}

/**
 * Looks up the latest verification record for a deployed contract's
 * `wasm_hash`. A `{ verified: false }` response is the normal "not yet
 * verified" answer and must not be treated as an error.
 */
export async function fetchVerificationStatus(
  wasmHash: string
): Promise<IndexerResult<VerificationRecord | null>> {
  const result = await fetchVerificationJson<VerificationLookupResponse>(
    `${VERIFY_PATH}/wasm/${wasmHash}`,
    { headers: { Accept: "application/json" } },
    REQUEST_TIMEOUT_MS
  );

  if (!result.available) return result;
  if ("verified" in result.data && result.data.verified === false) {
    return { available: true, data: null };
  }
  return { available: true, data: result.data as VerificationRecord };
}

/** Fetches the file tree (path + size) of a verified `wasm_hash`'s source. */
export async function fetchVerificationSourceTree(
  wasmHash: string
): Promise<IndexerResult<SourceFileMeta[]>> {
  const result = await fetchVerificationJson<{ wasmHash: string; files: SourceFileMeta[] }>(
    `${VERIFY_PATH}/wasm/${wasmHash}/source`,
    { headers: { Accept: "application/json" } },
    REQUEST_TIMEOUT_MS
  );

  if (!result.available) return result;
  return { available: true, data: result.data.files };
}

/** Fetches the content of one file from a verified contract's source tree. */
export async function fetchVerificationSourceFile(
  wasmHash: string,
  path: string
): Promise<IndexerResult<SourceFileContent>> {
  return fetchVerificationJson<SourceFileContent>(
    `${VERIFY_PATH}/wasm/${wasmHash}/source/${path}`,
    { headers: { Accept: "application/json" } },
    REQUEST_TIMEOUT_MS
  );
}

/**
 * Submits source and build metadata for a deployed contract. `files` must
 * be a non-empty map of file path -> full source content: the indexer
 * stores exactly what's submitted, it does not clone a repository or fetch
 * an archive on the caller's behalf.
 *
 * The returned record's `status` starts as `"pending"`; re-fetching
 * `fetchVerificationStatus(wasmHash)` is how the UI polls for a terminal
 * result once the build pipeline is live.
 */
export async function submitVerification(
  request: VerificationSubmissionRequest
): Promise<IndexerResult<VerificationRecord>> {
  return fetchVerificationJson<VerificationRecord>(
    VERIFY_PATH,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
    },
    SUBMIT_TIMEOUT_MS
  );
}
