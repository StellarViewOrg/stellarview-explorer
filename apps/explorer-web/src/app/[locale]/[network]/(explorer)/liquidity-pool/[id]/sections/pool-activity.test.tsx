import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PoolActivity } from "./pool-activity";

afterEach(cleanup);

vi.mock("@/lib/hooks", () => ({
  useLiquidityPoolActivity: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { useLiquidityPoolActivity } from "@/lib/hooks";

const poolId = "a".repeat(64);

describe("PoolActivity", () => {
  it("renders loading state", () => {
    vi.mocked(useLiquidityPoolActivity).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useLiquidityPoolActivity>);

    render(<PoolActivity id={poolId} />);

    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders empty state when there is no recorded activity", () => {
    vi.mocked(useLiquidityPoolActivity).mockReturnValue({
      data: { records: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useLiquidityPoolActivity>);

    render(<PoolActivity id={poolId} />);

    expect(screen.getByText("noActivity")).toBeInTheDocument();
  });

  it("renders deposit, withdraw, and trade effects", () => {
    vi.mocked(useLiquidityPoolActivity).mockReturnValue({
      data: {
        records: [
          {
            id: "1",
            type: "liquidity_pool_deposited",
            created_at: "2024-01-01T00:00:00Z",
            reserves_deposited: [
              { asset: "native", amount: "100" },
              { asset: "USDC:GA5Z", amount: "11" },
            ],
            shares_received: "50",
          },
          {
            id: "2",
            type: "liquidity_pool_withdrew",
            created_at: "2024-01-01T01:00:00Z",
            reserves_received: [
              { asset: "native", amount: "50" },
              { asset: "USDC:GA5Z", amount: "5.5" },
            ],
            shares_redeemed: "25",
          },
          {
            id: "3",
            type: "liquidity_pool_trade",
            created_at: "2024-01-01T02:00:00Z",
            sold: { asset: "native", amount: "10" },
            bought: { asset: "USDC:GA5Z", amount: "1.1" },
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useLiquidityPoolActivity>);

    render(<PoolActivity id={poolId} />);

    expect(screen.getByText("depositType")).toBeInTheDocument();
    expect(screen.getByText("withdrawType")).toBeInTheDocument();
    expect(screen.getByText("tradeType")).toBeInTheDocument();
  });
});
