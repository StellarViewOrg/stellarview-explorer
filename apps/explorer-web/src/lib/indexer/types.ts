// Frozen API contract types for the StellarViewOrg/indexer analytics endpoints.
// Matches the shape described in indexer#33. The explorer builds its full UI
// against these types; stubs/empty-series responses are expected until the
// indexer ships real aggregates.

/** Metrics available as time series. */
export type TimeSeriesMetric =
  | "tx_count"
  | "tx_volume"
  | "fee_classic"
  | "fee_soroban"
  | "active_accounts"
  | "new_accounts"
  | "asset_supply";

/** Metrics available for Top-N ranked views. */
export type TopNMetric = "contract_activity" | "asset_transfers" | "highest_fees";

/** Aggregation bucket size. */
export type Resolution = "hourly" | "daily" | "weekly";

/** Rolling window for Top-N queries. */
export type TimeWindow = "24h" | "7d" | "30d";

/** A single data point in a time series. */
export interface TimeSeriesDataPoint {
  /** ISO-8601 timestamp marking the start of the bucket. */
  timestamp: string;
  /** Aggregated value for this bucket. */
  value: number;
}

/** Response envelope for time-series queries. */
export interface TimeSeriesResponse {
  metric: TimeSeriesMetric;
  resolution: Resolution;
  from: string;
  to: string;
  data: TimeSeriesDataPoint[];
}

/** A single entry in a Top-N ranking. */
export interface TopNEntry {
  /** Entity identifier (contract ID, asset code-issuer, tx hash). */
  id: string;
  /** Human-readable label (contract name, asset code, truncated hash). */
  label: string;
  /** Ranking value (invocation count, transfer volume, fee amount). */
  value: number;
  /** Optional extra context (e.g. asset issuer, contract type). */
  metadata?: Record<string, unknown>;
}

/** Response envelope for Top-N queries. */
export interface TopNResponse {
  metric: TopNMetric;
  window: TimeWindow;
  data: TopNEntry[];
}

/**
 * Discriminated union returned by the indexer client.
 * `available: false` means the data hasn't been produced yet (or the indexer is
 * unreachable), and the caller should show a "not available" state.
 *
 * `not_indexed` is the domains endpoints' equivalent of `empty`: the indexer
 * answered normally but hasn't ingested any ledger yet. It is reported in the
 * response body, not as an HTTP error, so it must not be treated as a failure.
 */
export type IndexerResult<T> =
  | { available: true; data: T }
  | { available: false; reason: "not_configured" | "empty" | "not_indexed" | "error" };

// Soroban Domains read API (indexer#29). Contract frozen in the indexer repo at
// docs/domains-api.md. Availability is signaled by the `indexed` field in the
// body, never by an HTTP error status.

/** Whether a name points at a classic account or a Soroban contract. */
export type DomainTargetType = "account" | "contract";

/** Lifecycle state, computed by the indexer at read time. */
export type DomainStatus = "active" | "expired" | "revoked";

/** Registry event kinds recorded against a name. */
export type DomainEventType = "register" | "transfer" | "renew" | "claim" | "revoke";

/** A single domain record. */
export interface DomainRecord {
  name: string;
  owner: string;
  /** The address the name currently resolves to. */
  address: string;
  target_type: DomainTargetType;
  registered_at: string;
  expires_at: string;
  status: DomainStatus;
  last_event_ledger: number;
}

/** One entry in a name's history. */
export interface DomainEventRecord {
  name: string;
  event_type: DomainEventType;
  owner?: string;
  address?: string;
  expires_at?: string;
  transaction_hash: string;
  ledger_sequence: number;
  created_at: string;
}

/** Shared response envelope for every domains endpoint. */
export interface DomainsResponse {
  /** `false` until the indexer has ingested at least one ledger. */
  indexed: boolean;
  /** Single record for resolve-by-name, or the primary reverse-lookup match. */
  domain: DomainRecord | null;
  domains?: DomainRecord[];
  events?: DomainEventRecord[];
  /** Last `name` on this page; pass back as `cursor` for the next one. */
  cursor?: string;
}

/** Reverse lookup narrowed to what the badge needs. */
export interface DomainReverseLookup {
  domain: DomainRecord | null;
  domains: DomainRecord[];
}
