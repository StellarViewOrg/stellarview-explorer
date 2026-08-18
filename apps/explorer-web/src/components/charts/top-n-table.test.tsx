import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import TopNTable from "./top-n-table";
import { Trophy } from "lucide-react";

// Mock the hook and translations
vi.mock("@/lib/hooks", () => ({
  useIndexerTopN: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/providers", () => ({
  useNetwork: () => ({ network: "mainnet" }),
}));

import { useIndexerTopN } from "@/lib/hooks";

describe("TopNTable", () => {
  it("renders loading state", () => {
    vi.mocked(useIndexerTopN).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useIndexerTopN>);

    render(
      <TopNTable metric="contract_activity" title="Top Contracts" icon={Trophy} window="7d" />
    );

    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders not available state when data is unavailable", () => {
    vi.mocked(useIndexerTopN).mockReturnValue({
      data: { available: false, reason: "empty" },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useIndexerTopN>);

    render(
      <TopNTable metric="contract_activity" title="Top Contracts" icon={Trophy} window="7d" />
    );

    expect(screen.getByText("notAvailable.title")).toBeInTheDocument();
  });

  it("renders list items when data is available", () => {
    vi.mocked(useIndexerTopN).mockReturnValue({
      data: {
        available: true,
        data: {
          metric: "contract_activity",
          window: "7d",
          data: [
            { id: "C123", label: "Soroswap", value: 5000 },
            { id: "C456", label: "Blend", value: 3000 },
          ],
        },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useIndexerTopN>);

    render(
      <TopNTable metric="contract_activity" title="Top Contracts" icon={Trophy} window="7d" />
    );

    expect(screen.getByText("Soroswap")).toBeInTheDocument();
    expect(screen.getByText("Blend")).toBeInTheDocument();
    expect(screen.getByText("5K")).toBeInTheDocument(); // formatCompactNumber(5000)
  });
});
