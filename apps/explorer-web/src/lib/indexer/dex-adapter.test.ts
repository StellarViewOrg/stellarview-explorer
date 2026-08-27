import { describe, it, expect } from "vitest";
import {
  DexContractError,
  parseCandlesResponse,
  parsePairsResponse,
  parsePoolDepthResponse,
} from "./dex-adapter";
import pairsFixture from "./__fixtures__/pairs-response.json";
import candlesFixture from "./__fixtures__/candles-response.json";
import poolDepthFixture from "./__fixtures__/pool-depth-response.json";

// These tests pin the parsers against fixture JSON that documents the DEX
// contract this UI currently assumes (see the note in dex-adapter.ts).
// Reconciling with indexer#31's real, frozen contract is a two-step,
// CI-enforced process: update the fixture to match the real payload, then
// adjust the parser/dex-types.ts until this file passes again. A silent
// shape mismatch cannot slip through untested.
describe("indexer/dex-adapter contract fixtures", () => {
  it("parses the pairs fixture unchanged", () => {
    expect(parsePairsResponse(pairsFixture)).toEqual(pairsFixture);
  });

  it("parses the candles fixture unchanged", () => {
    expect(parseCandlesResponse(candlesFixture)).toEqual(candlesFixture);
  });

  it("parses the pool depth fixture unchanged", () => {
    expect(parsePoolDepthResponse(poolDepthFixture)).toEqual(poolDepthFixture);
  });

  describe("parsePairsResponse rejects contract drift", () => {
    it("rejects a non-object response", () => {
      expect(() => parsePairsResponse(null)).toThrow(DexContractError);
      expect(() => parsePairsResponse([])).toThrow(DexContractError);
    });

    it("rejects a missing data array", () => {
      expect(() => parsePairsResponse({})).toThrow(DexContractError);
    });

    it("rejects a pair missing required fields", () => {
      const malformed = { data: [{ id: "x" }] };
      expect(() => parsePairsResponse(malformed)).toThrow(DexContractError);
    });

    it("rejects a pair with the wrong field type", () => {
      const malformed = {
        data: [
          {
            ...pairsFixture.data[0],
            volume24h: "not-a-number",
          },
        ],
      };
      expect(() => parsePairsResponse(malformed)).toThrow(DexContractError);
    });

    it("accepts an empty data array (indexer#31 stub)", () => {
      expect(parsePairsResponse({ data: [] })).toEqual({ data: [] });
    });
  });

  describe("parseCandlesResponse rejects contract drift", () => {
    it("rejects a candle missing OHLC fields", () => {
      const malformed = { ...candlesFixture, data: [{ timestamp: "2024-01-01T00:00:00Z" }] };
      expect(() => parseCandlesResponse(malformed)).toThrow(DexContractError);
    });

    it("rejects a missing envelope field", () => {
      const malformed = {
        resolution: candlesFixture.resolution,
        from: candlesFixture.from,
        to: candlesFixture.to,
        data: candlesFixture.data,
      };
      expect(() => parseCandlesResponse(malformed)).toThrow(DexContractError);
    });
  });

  describe("parsePoolDepthResponse rejects contract drift", () => {
    it("rejects a reserve missing amount", () => {
      const malformed = {
        ...poolDepthFixture,
        data: [{ timestamp: "2024-01-01T00:00:00Z", reserves: [{ asset: "native" }], tvl: 1 }],
      };
      expect(() => parsePoolDepthResponse(malformed)).toThrow(DexContractError);
    });

    it("rejects a non-array reserves field", () => {
      const malformed = {
        ...poolDepthFixture,
        data: [{ timestamp: "2024-01-01T00:00:00Z", reserves: "native", tvl: 1 }],
      };
      expect(() => parsePoolDepthResponse(malformed)).toThrow(DexContractError);
    });
  });
});
