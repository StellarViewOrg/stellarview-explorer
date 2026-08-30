import type {
  VerificationRecord,
  SourceFileContent,
  VerificationSubmissionRequest,
  VerificationSubmissionResult,
} from "./verification-types";
import type { IndexerResult } from "./types";

/**
 * Client for the indexer's reproducible source verification API (indexer#36).
 *
 * Like the domains API, availability of the *service* and availability of a
 * *record* are different things: a `not_configured`/`error` result means the
 * indexer isn't reachable at all, while a successful response with
 * `verified: false` and no record is a legitimate "not verified" answer that
 * must render as an unverified badge, not an error.
 *
 * The verification build pipeline itself hasn't shipped yet at the time this
 * client was written — indexer#36 only commits to freezing this contract and
 * serving a stub. Until the real pipeline lands, every lookup here answers
 * `verified: false` and every submission answers `pending` forever, which the
 * UI surfaces as the "verification isn't available yet" state rather than a
 * broken form.
 */

const VERIFICATION_PATH = "/v1/verification";
const REQUEST_TIMEOUT_MS = 15_000;
const SUBMIT_TIMEOUT_MS = 30_000;

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_INDEXER_URL?.replace(/\/+$/, "") ?? "";
}

interface VerificationLookupResponse {
  verified: boolean;
  record: VerificationRecord | null;
}

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
 * Looks up the verification record for a deployed contract's `wasm_hash`.
 *
 * A `record: null` with `verified: false` is the normal "not yet verified"
 * answer and must not be treated as an error.
 */
export async function fetchVerificationStatus(
  wasmHash: string
): Promise<IndexerResult<VerificationRecord | null>> {
  const result = await fetchVerificationJson<VerificationLookupResponse>(
    `${VERIFICATION_PATH}/${wasmHash}`,
    { headers: { Accept: "application/json" } },
    REQUEST_TIMEOUT_MS
  );

  if (!result.available) return result;
  return { available: true, data: result.data.record };
}

/** Fetches the content of one file from a verified contract's source tree. */
export async function fetchVerificationSourceFile(
  wasmHash: string,
  path: string
): Promise<IndexerResult<SourceFileContent>> {
  const params = new URLSearchParams({ path });
  return fetchVerificationJson<SourceFileContent>(
    `${VERIFICATION_PATH}/${wasmHash}/source?${params}`,
    { headers: { Accept: "application/json" } },
    REQUEST_TIMEOUT_MS
  );
}

/**
 * Submits source and build metadata for a deployed contract. The returned
 * `submissionId` is used to poll `fetchVerificationSubmission` until the
 * sandboxed build finishes and the record resolves to a terminal status.
 */
export async function submitVerification(
  request: VerificationSubmissionRequest
): Promise<IndexerResult<VerificationSubmissionResult>> {
  return fetchVerificationJson<VerificationSubmissionResult>(
    VERIFICATION_PATH,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
    },
    SUBMIT_TIMEOUT_MS
  );
}

/** Polls the status of a previously submitted verification request. */
export async function fetchVerificationSubmission(
  submissionId: string
): Promise<IndexerResult<VerificationRecord>> {
  return fetchVerificationJson<VerificationRecord>(
    `${VERIFICATION_PATH}/submissions/${submissionId}`,
    { headers: { Accept: "application/json" } },
    REQUEST_TIMEOUT_MS
  );
}
