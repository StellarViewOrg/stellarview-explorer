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
 * `available: false` means the metric hasn't been aggregated yet (or the
 * indexer is unreachable), and the chart should show a "not available" state.
 */
export type IndexerResult<T> =
  | { available: true; data: T }
  | { available: false; reason: "not_configured" | "empty" | "error" };
