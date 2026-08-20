import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import CandlestickChart from "./candlestick-chart";

afterEach(cleanup);

vi.mock("@/lib/hooks", () => ({
  usePairCandles: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { usePairCandles } from "@/lib/hooks";

describe("CandlestickChart", () => {
  it("renders loading state", () => {
    vi.mocked(usePairCandles).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof usePairCandles>);

    render(
      <CandlestickChart
        pairId="XLM-native_USDC-GA5Z"
        resolution="1h"
        from="2024-01-01"
        to="2024-01-02"
      />
    );

    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders not available state when indexer#31 hasn't aggregated candles yet", () => {
    vi.mocked(usePairCandles).mockReturnValue({
      data: { available: false, reason: "empty" },
      isLoading: false,
      error: null,
    } as ReturnType<typeof usePairCandles>);

    render(
      <CandlestickChart
        pairId="XLM-native_USDC-GA5Z"
        resolution="1h"
        from="2024-01-01"
        to="2024-01-02"
      />
    );

    expect(screen.getByText("notAvailable.title")).toBeInTheDocument();
  });

  it("renders the chart when candles are available", () => {
    vi.mocked(usePairCandles).mockReturnValue({
      data: {
        available: true,
        data: {
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
        },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof usePairCandles>);

    const { container } = render(
      <CandlestickChart
        pairId="XLM-native_USDC-GA5Z"
        resolution="1h"
        from="2024-01-01"
        to="2024-01-02"
      />
    );

    expect(screen.queryByText("notAvailable.title")).not.toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
