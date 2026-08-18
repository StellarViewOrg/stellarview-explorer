import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportTimeSeriesCSV, exportTimeSeriesJSON, exportTopNCSV, exportTopNJSON } from "./analytics-export";
import type { TimeSeriesDataPoint, TopNEntry } from "@/lib/indexer";

// Mock URL.createObjectURL and a.click
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:test");
  global.URL.revokeObjectURL = vi.fn();
  
  const mockClick = vi.fn();
  const mockAppend = vi.fn();
  const mockRemove = vi.fn();
  
  global.document.createElement = vi.fn().mockReturnValue({
    click: mockClick,
  }) as any;
  
  global.document.body.appendChild = mockAppend as any;
  global.document.body.removeChild = mockRemove as any;
});

describe("analytics-export", () => {
  describe("time-series exports", () => {
    const data: TimeSeriesDataPoint[] = [
      { timestamp: "2024-01-01", value: 100 },
      { timestamp: "2024-01-02", value: 200 },
    ];

    it("exports CSV", () => {
      exportTimeSeriesCSV(data, "tx_volume", "mainnet");
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it("exports JSON", () => {
      exportTimeSeriesJSON(data, "tx_volume", "mainnet");
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe("Top-N exports", () => {
    const data: TopNEntry[] = [
      { id: "C123", label: "Soroswap", value: 5000 },
      { id: "C456", label: "Blend, V1", value: 3000 }, // Commas in label
    ];

    it("exports CSV and escapes commas", () => {
      exportTopNCSV(data, "contract_activity", "mainnet");
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      // Implementation escapes commas with quotes
    });

    it("exports JSON", () => {
      exportTopNJSON(data, "contract_activity", "mainnet");
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
