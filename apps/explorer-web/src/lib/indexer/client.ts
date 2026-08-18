import type {
  TimeSeriesMetric,
  TopNMetric,
  Resolution,
  TimeWindow,
  TimeSeriesResponse,
  TopNResponse,
  IndexerResult,
} from "./types";

/**
 * Returns the indexer base URL from the public env var.
 * Empty string or undefined → indexer is not configured.
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_INDEXER_URL?.replace(/\/+$/, "") ?? "";
}

/**
 * Fetch a time-series aggregation from the indexer.
 *
 * When the indexer isn't configured or a metric hasn't been aggregated yet
 * (empty `data` array in the response), returns `{ available: false }` so
 * the chart renders a "not available yet" empty state.
 */
export async function fetchTimeSeries(
  metric: TimeSeriesMetric,
  resolution: Resolution,
  from: string,
  to: string
): Promise<IndexerResult<TimeSeriesResponse>> {
  const base = getBaseUrl();
  if (!base) {
    return { available: false, reason: "not_configured" };
  }

  try {
    const params = new URLSearchParams({ metric, resolution, from, to });
    const response = await fetch(`${base}/api/v1/analytics/timeseries?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { available: false, reason: "error" };
    }

    const body = (await response.json()) as TimeSeriesResponse;

    // The indexer returns an empty `data` array for metrics that haven't
    // been aggregated yet. Treat this as "not available".
    if (!body.data || body.data.length === 0) {
      return { available: false, reason: "empty" };
    }

    return { available: true, data: body };
  } catch {
    return { available: false, reason: "error" };
  }
}

/**
 * Fetch a Top-N ranking from the indexer.
 *
 * Same availability semantics as `fetchTimeSeries`.
 */
export async function fetchTopN(
  metric: TopNMetric,
  window: TimeWindow,
  limit = 10
): Promise<IndexerResult<TopNResponse>> {
  const base = getBaseUrl();
  if (!base) {
    return { available: false, reason: "not_configured" };
  }

  try {
    const params = new URLSearchParams({
      metric,
      window,
      limit: String(limit),
    });
    const response = await fetch(`${base}/api/v1/analytics/top?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { available: false, reason: "error" };
    }

    const body = (await response.json()) as TopNResponse;

    if (!body.data || body.data.length === 0) {
      return { available: false, reason: "empty" };
    }

    return { available: true, data: body };
  } catch {
    return { available: false, reason: "error" };
  }
}
