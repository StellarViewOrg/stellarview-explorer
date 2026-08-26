import type {
  DomainsResponse,
  DomainReverseLookup,
  DomainsPage,
  DomainDetail,
  DomainStatus,
  IndexerResult,
} from "./types";

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

export const DOMAINS_DEFAULT_PAGE_SIZE = 50;
/** Matches the indexer's own cap. Larger values are rejected server side. */
export const DOMAINS_MAX_PAGE_SIZE = 200;

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

/** The registry stores names lowercase, and the indexer lowercases on read. */
function encodeName(name: string): string {
  return encodeURIComponent(name.trim().toLowerCase());
}

/**
 * One page of registered domains.
 *
 * `cursor` is the last name on the page; pass it back to fetch the next one.
 * The indexer returns no cursor on the final page, which is how the caller
 * knows to stop.
 */
export async function fetchDomainsList(
  status?: DomainStatus,
  limit = DOMAINS_DEFAULT_PAGE_SIZE,
  cursor = ""
): Promise<IndexerResult<DomainsPage>> {
  const params = new URLSearchParams({
    limit: String(Math.min(limit, DOMAINS_MAX_PAGE_SIZE)),
  });
  if (status) params.set("status", status);
  if (cursor) params.set("cursor", cursor);

  return fetchDomains(`${DOMAINS_PATH}?${params}`, (body) => ({
    domains: body.domains ?? [],
    cursor: body.cursor ?? "",
  }));
}

/**
 * A single name's record together with its event history.
 *
 * The two endpoints are independent, so they run concurrently. The record is
 * the authoritative one: without it there is nothing to render, and its reason
 * is the one the page should show. A history that fails on its own degrades to
 * an empty timeline rather than blanking the whole page.
 */
export async function fetchDomainDetail(
  name: string,
  eventLimit = DOMAINS_DEFAULT_PAGE_SIZE
): Promise<IndexerResult<DomainDetail>> {
  const encoded = encodeName(name);
  const params = new URLSearchParams({
    limit: String(Math.min(eventLimit, DOMAINS_MAX_PAGE_SIZE)),
  });

  const [record, history] = await Promise.all([
    fetchDomains(`${DOMAINS_PATH}/${encoded}`, (body) => body.domain ?? null),
    fetchDomains(`${DOMAINS_PATH}/${encoded}/events?${params}`, (body) => body.events ?? []),
  ]);

  if (!record.available) return record;

  return {
    available: true,
    data: { domain: record.data, events: history.available ? history.data : [] },
  };
}
