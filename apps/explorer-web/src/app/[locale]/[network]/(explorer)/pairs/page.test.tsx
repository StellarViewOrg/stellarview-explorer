import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import PairsPage from "./page";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

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

// AssetLogo fetches TOML metadata via TanStack Query; stub it out so this
// test doesn't need a QueryClientProvider.
vi.mock("@/components/common/asset-logo", () => ({
  AssetLogo: ({ code }: { code: string }) => <span data-testid="asset-logo">{code}</span>,
}));

vi.mock("@/lib/providers", () => ({
  useNetwork: () => ({ network: "testnet" }),
}));

const useDexPairs = vi.fn();
vi.mock("@/lib/hooks", () => ({
  useDexPairs: (...args: unknown[]) => useDexPairs(...args),
}));

// More than one page's worth, with volume descending by insertion order so
// the default sort (volume desc) keeps a predictable, easy-to-assert layout.
const PAIR_COUNT = DEFAULT_PAGE_SIZE + 5;
const pairs = Array.from({ length: PAIR_COUNT }, (_, i) => ({
  id: `pair-${i}`,
  base: { code: `TKN${i}`, issuer: "native" },
  counter: { code: "XLM", issuer: "native" },
  lastPrice: 0.1,
  priceChange24h: 1,
  volume24h: PAIR_COUNT - i,
  liquidity: 1000,
}));

describe("PairsPage pagination", () => {
  it("splits a pair list larger than one page and navigates between pages", () => {
    useDexPairs.mockReturnValue({
      data: { available: true, data: { data: pairs } },
      isLoading: false,
    });

    render(<PairsPage />);

    expect(screen.getByText("TKN0")).toBeInTheDocument();
    expect(screen.getByText(`TKN${DEFAULT_PAGE_SIZE - 1}`)).toBeInTheDocument();
    expect(screen.queryByText(`TKN${DEFAULT_PAGE_SIZE}`)).not.toBeInTheDocument();

    const previousButton = screen.getByRole("button", { name: "previous" });
    const nextButton = screen.getByRole("button", { name: "next" });
    expect(previousButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    expect(screen.queryByText("TKN0")).not.toBeInTheDocument();
    expect(screen.getByText(`TKN${PAIR_COUNT - 1}`)).toBeInTheDocument();
    expect(previousButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();

    fireEvent.click(previousButton);

    expect(screen.getByText("TKN0")).toBeInTheDocument();
    expect(previousButton).toBeDisabled();
  });

  it("resets to the first page when the search query narrows the results", () => {
    useDexPairs.mockReturnValue({
      data: { available: true, data: { data: pairs } },
      isLoading: false,
    });

    render(<PairsPage />);

    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByText(`TKN${PAIR_COUNT - 1}`)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), {
      target: { value: "TKN0" },
    });

    expect(screen.getByText("TKN0")).toBeInTheDocument();
    expect(screen.queryByText(`TKN${PAIR_COUNT - 1}`)).not.toBeInTheDocument();
  });

  it("shows the not-available empty state when the indexer has no pairs yet", () => {
    useDexPairs.mockReturnValue({
      data: { available: false, reason: "empty" },
      isLoading: false,
    });

    render(<PairsPage />);

    expect(screen.getByText("notAvailable.title")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "next" })).not.toBeInTheDocument();
  });
});
