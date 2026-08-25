import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DomainBadge } from "./domain-badge";
import type { DomainRecord } from "@/lib/indexer";

vi.mock("@/lib/hooks", () => ({ useDomainsByAddress: vi.fn() }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

import { useDomainsByAddress } from "@/lib/hooks";

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

function mockLookup(value: unknown, isLoading = false) {
  vi.mocked(useDomainsByAddress).mockReturnValue({
    data: value,
    isLoading,
  } as ReturnType<typeof useDomainsByAddress>);
}

describe("DomainBadge", () => {
  // vitest.config.ts does not set `globals`, so testing-library's automatic
  // cleanup never registers and rendered trees would leak between tests.
  afterEach(cleanup);

  it("renders nothing while the lookup is in flight", () => {
    mockLookup(undefined, true);

    const { container } = render(<DomainBadge address={ACCOUNT} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the domain the address owns", () => {
    mockLookup({ available: true, data: { domain: RECORD, domains: [RECORD] } });

    render(<DomainBadge address={ACCOUNT} />);

    expect(screen.getByText("alice.xlm")).toBeInTheDocument();
  });

  it("renders nothing when the address owns no domain", () => {
    mockLookup({ available: true, data: { domain: null, domains: [] } });

    const { container } = render(<DomainBadge address={ACCOUNT} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("counts the extra domains when an address owns several", () => {
    const second = { ...RECORD, name: "bob.xlm" };
    mockLookup({ available: true, data: { domain: RECORD, domains: [RECORD, second] } });

    render(<DomainBadge address={ACCOUNT} />);

    expect(screen.getByText("alice.xlm")).toBeInTheDocument();
    expect(screen.getByText("more")).toBeInTheDocument();
  });

  it("shows a pending state, not an error, before the indexer has data", () => {
    mockLookup({ available: false, reason: "not_indexed" });

    render(<DomainBadge address={ACCOUNT} />);

    expect(screen.getByText("notAvailable")).toBeInTheDocument();
  });

  it("shows the same pending state when the indexer is not configured", () => {
    mockLookup({ available: false, reason: "not_configured" });

    render(<DomainBadge address={ACCOUNT} />);

    expect(screen.getByText("notAvailable")).toBeInTheDocument();
  });

  it("shows the pending state rather than an error when the request fails", () => {
    mockLookup({ available: false, reason: "error" });

    render(<DomainBadge address={ACCOUNT} />);

    expect(screen.getByText("notAvailable")).toBeInTheDocument();
  });
});
