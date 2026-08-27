import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PairTrades } from "./pair-trades";
import type { Horizon } from "@stellar/stellar-sdk";

afterEach(cleanup);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const usePairTrades = vi.fn();
vi.mock("@/lib/hooks", () => ({
  usePairTrades: (...args: unknown[]) => usePairTrades(...args),
}));

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

function makeTrade(
  id: string,
  closeTime: string,
  baseAmount: string
): Horizon.ServerApi.TradeRecord {
  return {
    id,
    ledger_close_time: closeTime,
    base_is_seller: true,
    base_amount: baseAmount,
    counter_amount: "1.1000000",
    price: { n: "11", d: "100" },
  } as unknown as Horizon.ServerApi.TradeRecord;
}

describe("PairTrades", () => {
  it("renders trades newest-first, in the order the (desc-sorted) query returns them", () => {
    // The pairTrades query already requests `.order("desc")` from Horizon, so
    // the component must render `data.records` as-is rather than re-sorting.
    // Give each trade a distinct base_amount so row order is observable.
    const records = [
      makeTrade("trade-newest", "2024-01-03T00:00:00Z", "300.0000000"),
      makeTrade("trade-middle", "2024-01-02T00:00:00Z", "200.0000000"),
      makeTrade("trade-oldest", "2024-01-01T00:00:00Z", "100.0000000"),
    ];

    usePairTrades.mockReturnValue({
      data: { records },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <PairTrades
        baseCode="XLM"
        baseIssuer="native"
        counterCode="USDC"
        counterIssuer={USDC_ISSUER}
      />
    );

    const amounts = screen.getAllByText(/^(300|200|100)$/).map((el) => el.textContent);
    expect(amounts).toEqual(["300", "200", "100"]);
  });

  it("renders an empty state when there are no recent trades", () => {
    usePairTrades.mockReturnValue({
      data: { records: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <PairTrades
        baseCode="XLM"
        baseIssuer="native"
        counterCode="USDC"
        counterIssuer={USDC_ISSUER}
      />
    );

    expect(screen.getByText("noTrades")).toBeInTheDocument();
  });
});
