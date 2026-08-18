import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTimeSeries, fetchTopN } from "./client";

describe("indexer/client", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("fetchTimeSeries", () => {
    it("returns not_configured when URL is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "");
      const res = await fetchTimeSeries("tx_volume", "daily", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: false, reason: "not_configured" });
    });

    it("returns error when fetch fails", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

      const res = await fetchTimeSeries("tx_volume", "daily", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: false, reason: "error" });
    });

    it("returns empty when data array is empty", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ metric: "tx_volume", data: [] }),
      });

      const res = await fetchTimeSeries("tx_volume", "daily", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: false, reason: "empty" });
    });

    it("returns data on success", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      const mockData = { metric: "tx_volume", data: [{ timestamp: "2024-01-01", value: 10 }] };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const res = await fetchTimeSeries("tx_volume", "daily", "2024-01-01", "2024-01-02");
      expect(res).toEqual({ available: true, data: mockData });
    });
  });

  describe("fetchTopN", () => {
    it("returns not_configured when URL is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "");
      const res = await fetchTopN("contract_activity", "7d", 10);
      expect(res).toEqual({ available: false, reason: "not_configured" });
    });

    it("returns empty when data array is empty", async () => {
      vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ metric: "contract_activity", data: [] }),
      });

      const res = await fetchTopN("contract_activity", "7d", 10);
      expect(res).toEqual({ available: false, reason: "empty" });
    });
  });
});
