// Adapter layer between the raw JSON the indexer returns and the internal
// DEX types in `dex-types.ts`.
//
// indexer#31 has not published a frozen contract yet (see the note in
// `dex-types.ts`), so `dex-client.ts` cannot be validated against a real
// spec today. What this adapter *can* guarantee is that a response is never
// silently misparsed: every field the UI reads is structurally checked here,
// and a shape mismatch throws `DexContractError` instead of producing
// `undefined`s that would render as blank charts/tables.
//
// `dex-adapter.test.ts` locks these parsers against fixture JSON in
// `__fixtures__/`. When indexer#31 ships its real contract, reconciling is a
// two-step, CI-enforced process: update the fixtures to the real payloads,
// then adjust the parsers (and `dex-types.ts`) until the fixture tests pass
// again — a silent mismatch cannot slip through.

import type {
  Candle,
  CandleResolution,
  CandlesResponse,
  Pair,
  PairAsset,
  PairsResponse,
  PoolDepthPoint,
  PoolDepthResponse,
  PoolReserve,
} from "./dex-types";

export class DexContractError extends Error {
  constructor(message: string) {
    super(`indexer DEX response did not match the expected contract: ${message}`);
    this.name = "DexContractError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (!isObject(value)) throw new DexContractError(`${path} must be an object`);
  return value;
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new DexContractError(`${path} must be an array`);
  return value;
}

function expectString(value: unknown, path: string): string {
  if (!isString(value)) throw new DexContractError(`${path} must be a string`);
  return value;
}

function expectFiniteNumber(value: unknown, path: string): number {
  if (!isFiniteNumber(value)) throw new DexContractError(`${path} must be a finite number`);
  return value;
}

function expectNullableFiniteNumber(value: unknown, path: string): number | null {
  if (!isNullableFiniteNumber(value)) {
    throw new DexContractError(`${path} must be a finite number or null`);
  }
  return value;
}

function parsePairAsset(value: unknown, path: string): PairAsset {
  const obj = expectObject(value, path);
  return {
    code: expectString(obj.code, `${path}.code`),
    issuer: expectString(obj.issuer, `${path}.issuer`),
  };
}

function parsePair(value: unknown, path: string): Pair {
  const obj = expectObject(value, path);
  return {
    id: expectString(obj.id, `${path}.id`),
    base: parsePairAsset(obj.base, `${path}.base`),
    counter: parsePairAsset(obj.counter, `${path}.counter`),
    lastPrice: expectNullableFiniteNumber(obj.lastPrice, `${path}.lastPrice`),
    priceChange24h: expectNullableFiniteNumber(obj.priceChange24h, `${path}.priceChange24h`),
    volume24h: expectFiniteNumber(obj.volume24h, `${path}.volume24h`),
    liquidity: expectNullableFiniteNumber(obj.liquidity, `${path}.liquidity`),
  };
}

/** Parses and validates a `/api/v1/dex/pairs` response body. */
export function parsePairsResponse(body: unknown): PairsResponse {
  const obj = expectObject(body, "response");
  const data = expectArray(obj.data, "response.data");
  return { data: data.map((p, i) => parsePair(p, `response.data[${i}]`)) };
}

function parseCandle(value: unknown, path: string): Candle {
  const obj = expectObject(value, path);
  return {
    timestamp: expectString(obj.timestamp, `${path}.timestamp`),
    open: expectFiniteNumber(obj.open, `${path}.open`),
    high: expectFiniteNumber(obj.high, `${path}.high`),
    low: expectFiniteNumber(obj.low, `${path}.low`),
    close: expectFiniteNumber(obj.close, `${path}.close`),
    volume: expectFiniteNumber(obj.volume, `${path}.volume`),
  };
}

/** Parses and validates a `/api/v1/dex/candles` response body. */
export function parseCandlesResponse(body: unknown): CandlesResponse {
  const obj = expectObject(body, "response");
  const data = expectArray(obj.data, "response.data");
  return {
    pairId: expectString(obj.pairId, "response.pairId"),
    resolution: expectString(obj.resolution, "response.resolution") as CandleResolution,
    from: expectString(obj.from, "response.from"),
    to: expectString(obj.to, "response.to"),
    data: data.map((c, i) => parseCandle(c, `response.data[${i}]`)),
  };
}

function parsePoolReserve(value: unknown, path: string): PoolReserve {
  const obj = expectObject(value, path);
  return {
    asset: expectString(obj.asset, `${path}.asset`),
    amount: expectFiniteNumber(obj.amount, `${path}.amount`),
  };
}

function parsePoolDepthPoint(value: unknown, path: string): PoolDepthPoint {
  const obj = expectObject(value, path);
  const reserves = expectArray(obj.reserves, `${path}.reserves`);
  return {
    timestamp: expectString(obj.timestamp, `${path}.timestamp`),
    reserves: reserves.map((r, i) => parsePoolReserve(r, `${path}.reserves[${i}]`)),
    tvl: expectFiniteNumber(obj.tvl, `${path}.tvl`),
  };
}

/** Parses and validates a `/api/v1/dex/pool-depth` response body. */
export function parsePoolDepthResponse(body: unknown): PoolDepthResponse {
  const obj = expectObject(body, "response");
  const data = expectArray(obj.data, "response.data");
  return {
    poolId: expectString(obj.poolId, "response.poolId"),
    resolution: expectString(obj.resolution, "response.resolution") as CandleResolution,
    from: expectString(obj.from, "response.from"),
    to: expectString(obj.to, "response.to"),
    data: data.map((d, i) => parsePoolDepthPoint(d, `response.data[${i}]`)),
  };
}
