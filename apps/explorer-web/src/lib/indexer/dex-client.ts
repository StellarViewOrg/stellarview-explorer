import { getBaseUrl } from "./client";
import type { IndexerResult } from "./types";
import type {
  CandleResolution,
  CandlesResponse,
  PairsResponse,
  PoolDepthResponse,
} from "./dex-types";
import { parseCandlesResponse, parsePairsResponse, parsePoolDepthResponse } from "./dex-adapter";

/**
 * Fetch the trading pair list from the indexer.
 *
 * Same availability semantics as `fetchTimeSeries`/`fetchTopN`: not configured
 * when the indexer URL is unset, "empty" while indexer#31's aggregates
 * haven't been populated yet (its stub returns `data: []`), "error" on a
 * failed/non-OK request.
 */
export async function fetchPairs(limit = 50): Promise<IndexerResult<PairsResponse>> {
  const base = getBaseUrl();
  if (!base) {
    return { available: false, reason: "not_configured" };
  }

  try {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await fetch(`${base}/api/v1/dex/pairs?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { available: false, reason: "error" };
    }

    const body = parsePairsResponse(await response.json());

    if (body.data.length === 0) {
      return { available: false, reason: "empty" };
    }

    return { available: true, data: body };
  } catch {
    return { available: false, reason: "error" };
  }
}

/**
 * Fetch OHLC candles for a trading pair from the indexer.
 *
 * Same availability semantics as `fetchPairs`.
 */
export async function fetchCandles(
  pairId: string,
  resolution: CandleResolution,
  from: string,
  to: string
): Promise<IndexerResult<CandlesResponse>> {
  const base = getBaseUrl();
  if (!base) {
    return { available: false, reason: "not_configured" };
  }

  try {
    const params = new URLSearchParams({ pairId, resolution, from, to });
    const response = await fetch(`${base}/api/v1/dex/candles?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { available: false, reason: "error" };
    }

    const body = parseCandlesResponse(await response.json());

    if (body.data.length === 0) {
      return { available: false, reason: "empty" };
    }

    return { available: true, data: body };
  } catch {
    return { available: false, reason: "error" };
  }
}

/**
 * Fetch historical reserve/TVL depth for a liquidity pool from the indexer.
 *
 * Same availability semantics as `fetchPairs`/`fetchCandles`.
 */
export async function fetchPoolDepth(
  poolId: string,
  resolution: CandleResolution,
  from: string,
  to: string
): Promise<IndexerResult<PoolDepthResponse>> {
  const base = getBaseUrl();
  if (!base) {
    return { available: false, reason: "not_configured" };
  }

  try {
    const params = new URLSearchParams({ poolId, resolution, from, to });
    const response = await fetch(`${base}/api/v1/dex/pool-depth?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { available: false, reason: "error" };
    }

    const body = parsePoolDepthResponse(await response.json());

    if (body.data.length === 0) {
      return { available: false, reason: "empty" };
    }

    return { available: true, data: body };
  } catch {
    return { available: false, reason: "error" };
  }
}
