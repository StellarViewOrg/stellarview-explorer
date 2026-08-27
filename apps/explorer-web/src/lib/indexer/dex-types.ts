// Provisional API contract types for the StellarViewOrg/indexer DEX/LP
// aggregation endpoints (indexer#31). That issue is still open with no PR and
// no published OpenAPI contract yet — its HTTP server currently only exposes
// /metrics and /healthz. These shapes are inferred from #31's stated scope
// (pair identification, last price, 24h change/volume, OHLC candles at
// 1m/1h/1d) and mirror the pattern already frozen for analytics in
// `./types.ts` (indexer#33). Reconcile this file once indexer#31 publishes
// its real response shape.
//
// `dex-client.ts` never trusts a raw indexer response to match these types
// directly — every response is run through the runtime parsers in
// `dex-adapter.ts`, which are pinned against fixture JSON in
// `__fixtures__/` (see `dex-adapter.test.ts`). A shape mismatch (ours today,
// or the real indexer#31 contract once published) surfaces as a caught
// `DexContractError` — the client treats it the same as a failed request
// (`reason: "error"`) rather than silently misparsing.

/** One side of a trading pair. `issuer` is "native" for XLM. */
export interface PairAsset {
  code: string;
  issuer: string;
}

/** A trading pair identified from executed DEX offers / liquidity pool trades. */
export interface Pair {
  /** `${base.code}-${base.issuer}_${counter.code}-${counter.issuer}` */
  id: string;
  base: PairAsset;
  counter: PairAsset;
  lastPrice: number | null;
  /** Percent change over the last 24h. */
  priceChange24h: number | null;
  /** In counter-asset units. */
  volume24h: number;
  /** TVL estimate in counter-asset units, when the pair trades through a pool. */
  liquidity: number | null;
}

/** Response envelope for the pair list query. */
export interface PairsResponse {
  data: Pair[];
}

/** Candle aggregation bucket size. */
export type CandleResolution = "1m" | "1h" | "1d";

/** A single OHLC candle. */
export interface Candle {
  /** ISO-8601 timestamp marking the start of the bucket. */
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** In counter-asset units. */
  volume: number;
}

/** Response envelope for candle queries. */
export interface CandlesResponse {
  pairId: string;
  resolution: CandleResolution;
  from: string;
  to: string;
  data: Candle[];
}

/** One reserve balance within a liquidity pool depth snapshot. */
export interface PoolReserve {
  /** "native" for XLM, otherwise "CODE:ISSUER". */
  asset: string;
  amount: number;
}

/** A single historical depth snapshot for a liquidity pool. */
export interface PoolDepthPoint {
  /** ISO-8601 timestamp marking the start of the bucket. */
  timestamp: string;
  reserves: PoolReserve[];
  /** TVL estimate in a reference asset's units at this point in time. */
  tvl: number;
}

/** Response envelope for liquidity pool depth history queries. */
export interface PoolDepthResponse {
  poolId: string;
  resolution: CandleResolution;
  from: string;
  to: string;
  data: PoolDepthPoint[];
}
