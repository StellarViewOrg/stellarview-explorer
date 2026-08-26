import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DomainContent } from "./domain-content";
import type { DomainRecord, DomainEventRecord } from "@/lib/indexer";

vi.mock("@/lib/hooks", () => ({ useDomainDetail: vi.fn() }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { useDomainDetail } from "@/lib/hooks";

const ACCOUNT = "GA62IQXVM62EIMLR2Z63L3V2HLBF2RPCSXTQKPEHEGTR6ARVYW4SUKLF";
const CONTRACT = "CC75Z72OCE667WVPQOROIWDAGBOXFNJ4VQONQEURL74EYIDLWA4F7FEN";
// The owner of a name and the address it resolves to are independent, so keep
// them distinct in fixtures to catch the two being wired to the same link.
const OWNER = "GCDBA5C4YHVUHVQDPTBBHDCXAZQFCT4KEXGJYZRMPHXBTDDBTRXVW7VS";
const TX = "a".repeat(64);

const RECORD: DomainRecord = {
  name: "alice.xlm",
  owner: OWNER,
  address: ACCOUNT,
  target_type: "account",
  registered_at: "2026-01-01T00:00:00Z",
  expires_at: "2027-01-01T00:00:00Z",
  status: "active",
  last_event_ledger: 12345,
};

const EVENTS: DomainEventRecord[] = [
  {
    name: "alice.xlm",
    event_type: "register",
    owner: ACCOUNT,
    address: ACCOUNT,
    transaction_hash: TX,
    ledger_sequence: 12345,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    name: "alice.xlm",
    event_type: "transfer",
    owner: ACCOUNT,
    address: ACCOUNT,
    transaction_hash: "b".repeat(64),
    ledger_sequence: 12400,
    created_at: "2026-02-01T00:00:00Z",
  },
];

function mockDetail(value: unknown, isLoading = false) {
  vi.mocked(useDomainDetail).mockReturnValue({
    data: value,
    isLoading,
  } as ReturnType<typeof useDomainDetail>);
}

describe("DomainContent", () => {
  afterEach(cleanup);

  it("shows a pending state, not an error, before the indexer has data", () => {
    mockDetail({ available: false, reason: "not_indexed" });

    render(<DomainContent name="alice.xlm" />);

    expect(screen.getByText("notAvailable")).toBeInTheDocument();
  });

  it("shows the same pending state when the indexer is unreachable", () => {
    mockDetail({ available: false, reason: "error" });

    render(<DomainContent name="alice.xlm" />);

    expect(screen.getByText("notAvailable")).toBeInTheDocument();
  });

  it("distinguishes an unregistered name from unavailable data", () => {
    mockDetail({ available: true, data: { domain: null, events: [] } });

    render(<DomainContent name="nope.xlm" />);

    expect(screen.getByText("notRegistered")).toBeInTheDocument();
    expect(screen.queryByText("notAvailable")).not.toBeInTheDocument();
  });

  it("renders the registration and links the resolved account", () => {
    mockDetail({ available: true, data: { domain: RECORD, events: EVENTS } });

    render(<DomainContent name="alice.xlm" />);

    expect(screen.getByText("registration")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /GA62IQ/ })).toHaveAttribute(
      "href",
      `/account/${ACCOUNT}`
    );
    expect(screen.getByRole("link", { name: /GCDBA5/ })).toHaveAttribute(
      "href",
      `/account/${OWNER}`
    );
  });

  it("links a contract target to the contract page", () => {
    mockDetail({
      available: true,
      data: {
        domain: { ...RECORD, address: CONTRACT, target_type: "contract" },
        events: [],
      },
    });

    render(<DomainContent name="alice.xlm" />);

    expect(screen.getByRole("link", { name: /CC75Z7/ })).toHaveAttribute(
      "href",
      `/contract/${CONTRACT}`
    );
  });

  it("renders every event in the history, linked to its transaction", () => {
    mockDetail({ available: true, data: { domain: RECORD, events: EVENTS } });

    render(<DomainContent name="alice.xlm" />);

    expect(screen.getByText("event.register")).toBeInTheDocument();
    expect(screen.getByText("event.transfer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /aaaaaa/ })).toHaveAttribute("href", `/tx/${TX}`);
  });

  it("shows an empty timeline when the name has no indexed events", () => {
    mockDetail({ available: true, data: { domain: RECORD, events: [] } });

    render(<DomainContent name="alice.xlm" />);

    expect(screen.getByText("noEvents")).toBeInTheDocument();
  });
});
