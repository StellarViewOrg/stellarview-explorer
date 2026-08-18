import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TimeSeriesChart from "./time-series-chart";
import { Activity } from "lucide-react";

// Mock the hook and translations
vi.mock("@/lib/hooks", () => ({
  useIndexerTimeSeries: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/providers", () => ({
  useNetwork: () => ({ network: "mainnet" }),
}));

import { useIndexerTimeSeries } from "@/lib/hooks";

describe("TimeSeriesChart", () => {
  it("renders loading state", () => {
    vi.mocked(useIndexerTimeSeries).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(
      <TimeSeriesChart
        metric="tx_volume"
        title="Transaction Volume"
        icon={Activity}
        resolution="daily"
        from="2024-01-01"
        to="2024-01-02"
      />
    );

    // ChartSkeleton renders a div with animate-pulse
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders not available state when data is unavailable", () => {
    vi.mocked(useIndexerTimeSeries).mockReturnValue({
      data: { available: false, reason: "empty" },
      isLoading: false,
      error: null,
    } as any);

    render(
      <TimeSeriesChart
        metric="tx_volume"
        title="Transaction Volume"
        icon={Activity}
        resolution="daily"
        from="2024-01-01"
        to="2024-01-02"
      />
    );

    expect(screen.getByText("notAvailable.title")).toBeInTheDocument();
  });

  it("renders chart when data is available", () => {
    vi.mocked(useIndexerTimeSeries).mockReturnValue({
      data: {
        available: true,
        data: {
          metric: "tx_volume",
          resolution: "daily",
          from: "2024-01-01",
          to: "2024-01-02",
          data: [{ timestamp: "2024-01-01T00:00:00Z", value: 100 }],
        },
      },
      isLoading: false,
      error: null,
    } as any);

    render(
      <TimeSeriesChart
        metric="tx_volume"
        title="Transaction Volume"
        icon={Activity}
        resolution="daily"
        from="2024-01-01"
        to="2024-01-02"
      />
    );

    // ResponsiveContainer will render its content (the Recharts wrapper)
    // Recharts uses a div with class "recharts-wrapper"
    const wrapper = document.querySelector(".recharts-wrapper");
    expect(wrapper).toBeInTheDocument();
  });
});
