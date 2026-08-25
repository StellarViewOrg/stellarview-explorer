import type { DomainsResponse, DomainReverseLookup, IndexerResult } from "./types";

/**
 * Client for the indexer's Soroban Domains read API (indexer#29).
 *
 * Availability is always signaled in the JSON body through `indexed`, never by
 * an HTTP error status, so a `false` there is a legitimate "not ingested yet"
 * answer and must render an empty state rather than an error. An empty list, by
 * contrast, is a real answer: the address simply owns no domain.
 *
 * Note the path prefix is `/v1/domains`, not the `/api/v1/...` the analytics
 * endpoints use. Both are served by the same listener.
 */

const DOMAINS_PATH = "/v1/domains";
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Returns the indexer base URL from the public env var.
 * Empty string or undefined means the indexer is not configured.
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_INDEXER_URL?.replace(/\/+$/, "") ?? "";
}

/**
 * Runs one domains request and normalizes every failure mode into
 * `IndexerResult`, so no caller ever sees a raw fetch or parse error.
 */
async function fetchDomains<T>(
  path: string,
  select: (body: DomainsResponse) => T
): Promise<IndexerResult<T>> {
  const base = getBaseUrl();
  if (!base) {
    return { available: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(`${base}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { available: false, reason: "error" };
    }

    const body = (await response.json()) as DomainsResponse;

    if (!body.indexed) {
      return { available: false, reason: "not_indexed" };
    }

    return { available: true, data: select(body) };
  } catch {
    return { available: false, reason: "error" };
  }
}

/**
 * Reverse lookup: which domains currently resolve to this address.
 *
 * `domain` is the first active match, or `null` when the address owns none.
 * A `null` here is an answer, not a failure, and the badge must render nothing.
 */
export async function fetchDomainsByAddress(
  address: string
): Promise<IndexerResult<DomainReverseLookup>> {
  const params = new URLSearchParams({ address });

  return fetchDomains(`${DOMAINS_PATH}?${params}`, (body) => ({
    domain: body.domain ?? null,
    domains: body.domains ?? [],
  }));
}
