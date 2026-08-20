import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PairTable, PairTableNotAvailable, type PairData } from "./pair-table";

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

// AssetLogo fetches TOML metadata via TanStack Query; stub it out so these
// tests don't need a QueryClientProvider.
vi.mock("@/components/common/asset-logo", () => ({
  AssetLogo: ({ code }: { code: string }) => <span data-testid="asset-logo">{code}</span>,
}));

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const AQUA_ISSUER = "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA";

const pairs: PairData[] = [
  {
    id: "1",
    base: { code: "XLM", issuer: "native" },
    counter: { code: "USDC", issuer: USDC_ISSUER },
    lastPrice: 0.11,
    priceChange24h: 2.5,
    volume24h: 100_000,
    liquidity: 500_000,
  },
  {
    id: "2",
    base: { code: "AQUA", issuer: AQUA_ISSUER },
    counter: { code: "XLM", issuer: "native" },
    lastPrice: 0.0004,
    priceChange24h: -1.2,
    volume24h: 20_000,
    liquidity: 80_000,
  },
];

describe("PairTable", () => {
  it("renders each pair as a link to its detail page", () => {
    render(<PairTable pairs={pairs} sortKey="volume" sortDir="desc" onSortChange={vi.fn()} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", `/pair/XLM-native_USDC-${USDC_ISSUER}`);
    expect(links[1]).toHaveAttribute("href", `/pair/AQUA-${AQUA_ISSUER}_XLM-native`);
  });

  it("calls onSortChange when a sortable header is clicked", () => {
    const onSortChange = vi.fn();
    render(<PairTable pairs={pairs} sortKey="volume" sortDir="desc" onSortChange={onSortChange} />);

    fireEvent.click(screen.getByText("liquidity"));
    expect(onSortChange).toHaveBeenCalledWith("liquidity");
  });

  it("renders an empty state when there are no pairs", () => {
    render(<PairTable pairs={[]} sortKey="volume" sortDir="desc" onSortChange={vi.fn()} />);
    expect(screen.getByText("noPairsFound")).toBeInTheDocument();
  });

  it("renders a dash for a low-liquidity pair with no price/liquidity data yet", () => {
    const lowLiquidityPair: PairData = {
      id: "3",
      base: { code: "EMPTY", issuer: USDC_ISSUER },
      counter: { code: "XLM", issuer: "native" },
      lastPrice: null,
      priceChange24h: null,
      volume24h: 0,
      liquidity: null,
    };

    render(
      <PairTable
        pairs={[lowLiquidityPair]}
        sortKey="volume"
        sortDir="desc"
        onSortChange={vi.fn()}
      />
    );

    // price, priceChange (desktop + mobile), and liquidity each fall back to "-"
    expect(screen.getAllByText("-")).toHaveLength(4);
  });
});

describe("PairTableNotAvailable", () => {
  it("renders the not-available copy", () => {
    render(<PairTableNotAvailable />);
    expect(screen.getByText("notAvailable.title")).toBeInTheDocument();
  });
});
