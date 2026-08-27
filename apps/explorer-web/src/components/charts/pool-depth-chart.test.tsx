import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PoolDepthChart, toDepthChartData } from "./pool-depth-chart";
import poolDepthFixture from "@/lib/indexer/__fixtures__/pool-depth-response.json";

afterEach(cleanup);

vi.mock("@/lib/hooks", () => ({
  usePoolDepth: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { usePoolDepth } from "@/lib/hooks";

const poolId = "a".repeat(64);

describe("toDepthChartData", () => {
  it("plots the exact TVL/reserve values from the indexer's pool depth fixture", () => {
    expect(toDepthChartData(poolDepthFixture.data)).toEqual(
      poolDepthFixture.data.map((d) => ({
        timestamp: d.timestamp,
        tvl: d.tvl,
        reserves: d.reserves,
      }))
    );
  });
});

describe("PoolDepthChart", () => {
  it("renders loading state", () => {
    vi.mocked(usePoolDepth).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof usePoolDepth>);

    render(<PoolDepthChart poolId={poolId} resolution="1h" from="2024-01-01" to="2024-01-02" />);

    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders not available state when indexer#31 hasn't aggregated depth yet", () => {
    vi.mocked(usePoolDepth).mockReturnValue({
      data: { available: false, reason: "empty" },
      isLoading: false,
      error: null,
    } as ReturnType<typeof usePoolDepth>);

    render(<PoolDepthChart poolId={poolId} resolution="1h" from="2024-01-01" to="2024-01-02" />);

    expect(screen.getByText("notAvailable.title")).toBeInTheDocument();
  });

  it("renders the chart when depth history is available", () => {
    vi.mocked(usePoolDepth).mockReturnValue({
      data: { available: true, data: poolDepthFixture },
      isLoading: false,
      error: null,
    } as ReturnType<typeof usePoolDepth>);

    const { container } = render(
      <PoolDepthChart
        poolId={poolDepthFixture.poolId}
        resolution="1d"
        from={poolDepthFixture.from}
        to={poolDepthFixture.to}
      />
    );

    expect(screen.queryByText("notAvailable.title")).not.toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
