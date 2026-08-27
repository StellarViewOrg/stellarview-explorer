import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DomainsPage from "./page";
import { DOMAINS_DEFAULT_PAGE_SIZE } from "@/lib/indexer";
import type { DomainRecord } from "@/lib/indexer";

const push = vi.fn();

vi.mock("@/lib/hooks", () => ({ useDomainsList: vi.fn() }));
vi.mock("@/lib/providers", () => ({ useNetwork: () => ({ network: "mainnet" }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { useDomainsList } from "@/lib/hooks";

const ACCOUNT = "GA62IQXVM62EIMLR2Z63L3V2HLBF2RPCSXTQKPEHEGTR6ARVYW4SUKLF";

const RECORD: DomainRecord = {
  name: "alice.xlm",
  owner: ACCOUNT,
  address: ACCOUNT,
  target_type: "account",
  registered_at: "2026-01-01T00:00:00Z",
  expires_at: "2027-01-01T00:00:00Z",
  status: "active",
  last_event_ledger: 12345,
};

function mockList(value: unknown, isLoading = false) {
  vi.mocked(useDomainsList).mockReturnValue({
    data: value,
    isLoading,
  } as ReturnType<typeof useDomainsList>);
}

/**
 * happy-dom does not perform implicit form submission when a submit button is
 * clicked, so submit the form itself rather than the button.
 */
function submitNameForm(value: string) {
  const input = screen.getByLabelText("namePlaceholder");
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest("form")!);
}

describe("DomainsPage", () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
  });

  it("shows a pending state, not an error, before the indexer has data", () => {
    mockList({ available: false, reason: "not_indexed" });

    render(<DomainsPage />);

    expect(screen.getByText("notAvailable")).toBeInTheDocument();
  });

  it("shows the same pending state when the indexer is not configured", () => {
    mockList({ available: false, reason: "not_configured" });

    render(<DomainsPage />);

    expect(screen.getByText("notAvailable")).toBeInTheDocument();
  });

  it("distinguishes an empty result from unavailable data", () => {
    mockList({ available: true, data: { domains: [], cursor: "" } });

    render(<DomainsPage />);

    expect(screen.getByText("noneRegistered")).toBeInTheDocument();
    expect(screen.queryByText("notAvailable")).not.toBeInTheDocument();
  });

  it("lists domains, each linked to its detail page", () => {
    mockList({ available: true, data: { domains: [RECORD], cursor: "" } });

    render(<DomainsPage />);

    expect(screen.getByText("alice.xlm")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /alice\.xlm/ })).toHaveAttribute(
      "href",
      "/domain/alice.xlm"
    );
  });

  it("disables paging when the indexer returns no further cursor", () => {
    mockList({ available: true, data: { domains: [RECORD], cursor: "" } });

    render(<DomainsPage />);

    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  /**
   * The indexer sets the cursor to the last name on every non-empty page,
   * including the final one, so a cursor by itself does not mean more exist.
   * Trusting it leaves Next enabled forever and walks the user into a blank
   * page. A short page is the end of the list.
   */
  it("disables paging on a short final page even though a cursor came back", () => {
    mockList({ available: true, data: { domains: [RECORD], cursor: "alice.xlm" } });

    render(<DomainsPage />);

    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("enables paging forward on a full page", () => {
    const full = Array.from({ length: DOMAINS_DEFAULT_PAGE_SIZE }, (_, i) => ({
      ...RECORD,
      name: `name${i}.xlm`,
    }));
    mockList({ available: true, data: { domains: full, cursor: full.at(-1)!.name } });

    render(<DomainsPage />);

    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  it("jumps to the detail page for an exact name", () => {
    mockList({ available: true, data: { domains: [], cursor: "" } });

    render(<DomainsPage />);
    submitNameForm("Bob.XLM");

    expect(push).toHaveBeenCalledWith("/domain/bob.xlm");
  });

  it("rejects a name that is not a domain instead of navigating", () => {
    mockList({ available: true, data: { domains: [], cursor: "" } });

    render(<DomainsPage />);
    submitNameForm("not-a-domain");

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText("invalidName")).toBeInTheDocument();
  });
});
