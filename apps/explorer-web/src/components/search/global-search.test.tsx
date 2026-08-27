import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GlobalSearch } from "./global-search";
import type { DomainResolution } from "@/lib/stellar";

const push = vi.fn();

vi.mock("@/lib/hooks", () => ({ useDomainResolution: vi.fn() }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));

import { useDomainResolution } from "@/lib/hooks";

/**
 * The component persists recent searches. happy-dom does not provide a usable
 * localStorage here, so back it with a plain in-memory map rather than changing
 * production code for the test's sake.
 */
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
});

const ALICE = "GA62IQXVM62EIMLR2Z63L3V2HLBF2RPCSXTQKPEHEGTR6ARVYW4SUKLF";

const resolved = (name: string, address: string): DomainResolution => ({
  status: "resolved",
  name,
  address,
  targetType: "account",
});

function mockResolution(value: DomainResolution | undefined, isFetching = false) {
  vi.mocked(useDomainResolution).mockReturnValue({
    data: value,
    isFetching,
  } as ReturnType<typeof useDomainResolution>);
}

/** Opens the palette and types into it. */
function typeQuery(value: string) {
  fireEvent.click(screen.getAllByRole("button")[0]);
  fireEvent.change(screen.getByRole("combobox"), { target: { value } });
}

describe("GlobalSearch domain resolution", () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
    store.clear();
  });

  it("navigates to the address a domain resolved to", () => {
    mockResolution(resolved("alice.xlm", ALICE));

    render(<GlobalSearch />);
    typeQuery("alice.xlm");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

    expect(push).toHaveBeenCalledWith(`/account/${ALICE}`);
  });

  it("shows the resolved address under the query", () => {
    mockResolution(resolved("alice.xlm", ALICE));

    render(<GlobalSearch />);
    typeQuery("alice.xlm");

    expect(screen.getByText("domainResolved")).toBeInTheDocument();
  });

  /**
   * The resolution query lags the input by the debounce, so a freshly typed
   * name still sees the previous name's result. Acting on it would send the
   * user to somebody else's account.
   */
  it("never navigates to a resolution belonging to a different name", () => {
    mockResolution(resolved("alice.xlm", ALICE));

    render(<GlobalSearch />);
    typeQuery("bob.xlm");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

    expect(push).not.toHaveBeenCalledWith(`/account/${ALICE}`);
    expect(push).toHaveBeenCalledWith("/search?q=bob.xlm");
  });

  it("does not show a stale resolution while a new name is still resolving", () => {
    mockResolution(resolved("alice.xlm", ALICE));

    render(<GlobalSearch />);
    typeQuery("bob.xlm");

    expect(screen.getByText("domainResolving")).toBeInTheDocument();
    expect(screen.queryByText("domainResolved")).not.toBeInTheDocument();
  });

  it("hands an unresolved domain to the search page rather than guessing", () => {
    mockResolution({ status: "not_found", name: "nope.xlm" });

    render(<GlobalSearch />);
    typeQuery("nope.xlm");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/search?q=nope.xlm");
  });

  it("reports why a domain did not resolve without leaking the cause", () => {
    mockResolution({ status: "error", name: "alice.xlm" });

    render(<GlobalSearch />);
    typeQuery("alice.xlm");

    expect(screen.getByText("domainError")).toBeInTheDocument();
  });

  it("leaves non-domain queries on their existing route", () => {
    mockResolution(undefined);

    render(<GlobalSearch />);
    typeQuery(ALICE);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

    expect(push).toHaveBeenCalledWith(`/account/${ALICE}`);
  });
});
