import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AccountBalances } from "./account-balances";
import type { Horizon } from "@stellar/stellar-sdk";

afterEach(cleanup);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const poolId = "b".repeat(64);

describe("AccountBalances", () => {
  it("links liquidity pool share balances to the pool detail page", () => {
    const account = {
      balances: [
        {
          asset_type: "native",
          balance: "100.0000000",
          buying_liabilities: "0",
          selling_liabilities: "0",
        },
        {
          asset_type: "liquidity_pool_shares",
          liquidity_pool_id: poolId,
          balance: "42.0000000",
          limit: "1000",
          last_modified_ledger: 1,
          is_authorized: true,
          is_authorized_to_maintain_liabilities: true,
          is_clawback_enabled: false,
        },
      ],
    } as unknown as Horizon.ServerApi.AccountRecord;

    render(<AccountBalances account={account} />);

    expect(screen.getByText("poolShares")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/liquidity-pool/${poolId}`);
  });
});
