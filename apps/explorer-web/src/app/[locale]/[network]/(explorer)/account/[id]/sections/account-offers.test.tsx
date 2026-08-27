import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AccountOffers } from "./account-offers";
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

const useAccountOffers = vi.fn();
vi.mock("@/lib/hooks", () => ({
  useAccountOffers: (...args: unknown[]) => useAccountOffers(...args),
}));

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("AccountOffers", () => {
  it("links each open offer to its trading pair detail page", () => {
    useAccountOffers.mockReturnValue({
      data: {
        records: [
          {
            id: "1",
            selling: { asset_type: "native" },
            buying: {
              asset_type: "credit_alphanum4",
              asset_code: "USDC",
              asset_issuer: USDC_ISSUER,
            },
            amount: "100.0000000",
            price: "0.11",
          } as Horizon.ServerApi.OfferRecord,
        ],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AccountOffers accountId="GACCOUNT" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/pair/XLM-native_USDC-${USDC_ISSUER}`);
  });

  it("renders an empty state when there are no open offers", () => {
    useAccountOffers.mockReturnValue({
      data: { records: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AccountOffers accountId="GACCOUNT" />);
    expect(screen.getByText("noOpenOffers")).toBeInTheDocument();
  });
});
