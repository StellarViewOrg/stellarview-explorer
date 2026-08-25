import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPairs, fetchCandles, fetchPoolDepth } from "./dex-client";

describe("indexer/dex-client", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("fetchPairs", () => {
    it("returns not_configured when URL is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "");
      const res = await fetchPairs();
      expect(res).toEqual({ available: false, reason: "not_configured" });
    });

    it("returns error when fetch fails", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

      const res = await fetchPairs();
      expect(res).toEqual({ available: false, reason: "error" });
    });

    it("returns error when response is not ok", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      const res = await fetchPairs();
      expect(res).toEqual({ available: false, reason: "error" });
    });

    it("returns error (not a silent misparse) when the response doesn't match the contract", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        // Missing `base`/`counter`/etc — simulates indexer#31 shipping a
        // different real shape than the one this UI assumed.
        json: () => Promise.resolve({ data: [{ id: "x" }] }),
      });

      const res = await fetchPairs();
      expect(res).toEqual({ available: false, reason: "error" });
    });

    it("returns empty when data array is empty (indexer#31 stub)", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const res = await fetchPairs();
      expect(res).toEqual({ available: false, reason: "empty" });
    });

    it("returns data on success", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      const mockData = {
        data: [
          {
            id: "XLM-native_USDC-GA5Z",
            base: { code: "XLM", issuer: "native" },
            counter: { code: "USDC", issuer: "GA5Z" },
            lastPrice: 0.11,
            priceChange24h: 2.5,
            volume24h: 100000,
            liquidity: 500000,
          },
        ],
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const res = await fetchPairs();
      expect(res).toEqual({ available: true, data: mockData });
    });
  });

  describe("fetchCandles", () => {
    it("returns not_configured when URL is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "");
      const res = await fetchCandles("XLM-native_USDC-GA5Z", "1h", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: false, reason: "not_configured" });
    });

    it("returns error when fetch fails", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

      const res = await fetchCandles("XLM-native_USDC-GA5Z", "1h", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: false, reason: "error" });
    });

    it("returns error when response is not ok", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      const res = await fetchCandles("XLM-native_USDC-GA5Z", "1h", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: false, reason: "error" });
    });

    it("returns empty when data array is empty (indexer#31 stub)", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            pairId: "XLM-native_USDC-GA5Z",
            resolution: "1h",
            from: "2024-01-01",
            to: "2024-01-02",
            data: [],
          }),
      });

      const res = await fetchCandles("XLM-native_USDC-GA5Z", "1h", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: false, reason: "empty" });
    });

    it("returns data on success", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      const mockData = {
        pairId: "XLM-native_USDC-GA5Z",
        resolution: "1h",
        from: "2024-01-01",
        to: "2024-01-02",
        data: [
          {
            timestamp: "2024-01-01T00:00:00Z",
            open: 0.1,
            high: 0.12,
            low: 0.09,
            close: 0.11,
            volume: 1000,
          },
        ],
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const res = await fetchCandles("XLM-native_USDC-GA5Z", "1h", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: true, data: mockData });
    });
  });

  describe("fetchPoolDepth", () => {
    const poolId = "a".repeat(64);

    it("returns not_configured when URL is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "");
      const res = await fetchPoolDepth(poolId, "1h", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: false, reason: "not_configured" });
    });

    it("returns error when fetch fails", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

      const res = await fetchPoolDepth(poolId, "1h", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: false, reason: "error" });
    });

    it("returns error when response is not ok", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      const res = await fetchPoolDepth(poolId, "1h", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: false, reason: "error" });
    });

    it("returns empty when data array is empty (indexer#31 stub)", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            poolId,
            resolution: "1h",
            from: "2024-01-01",
            to: "2024-01-02",
            data: [],
          }),
      });

      const res = await fetchPoolDepth(poolId, "1h", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: false, reason: "empty" });
    });

    it("returns data on success", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      const mockData = {
        poolId,
        resolution: "1h",
        from: "2024-01-01",
        to: "2024-01-02",
        data: [
          {
            timestamp: "2024-01-01T00:00:00Z",
            reserves: [
              { asset: "native", amount: 1_000_000 },
              { asset: "USDC:GA5Z", amount: 110_000 },
            ],
            tvl: 2_000_000,
          },
        ],
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const res = await fetchPoolDepth(poolId, "1h", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: true, data: mockData });
    });
  });
});
