import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchDomainsByAddress } from "./domains";
import type { DomainRecord } from "./types";

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

function mockResponse(body: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });
}

describe("indexer/domains", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns not_configured when the indexer URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "");

    await expect(fetchDomainsByAddress(ACCOUNT)).resolves.toEqual({
      available: false,
      reason: "not_configured",
    });
  });

  it("returns not_indexed when the indexer has no domain data yet", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse({ indexed: false, domain: null, domains: [] });

    await expect(fetchDomainsByAddress(ACCOUNT)).resolves.toEqual({
      available: false,
      reason: "not_indexed",
    });
  });

  it("treats not_indexed as an answer, not an HTTP failure", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    // The indexer answers 200 with indexed:false rather than an error status.
    mockResponse({ indexed: false, domain: null }, true);

    const result = await fetchDomainsByAddress(ACCOUNT);

    expect(result).toMatchObject({ available: false, reason: "not_indexed" });
    expect(result).not.toMatchObject({ reason: "error" });
  });

  it("returns an empty match when the address owns no domain", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse({ indexed: true, domain: null, domains: [] });

    await expect(fetchDomainsByAddress(ACCOUNT)).resolves.toEqual({
      available: true,
      data: { domain: null, domains: [] },
    });
  });

  it("returns the primary match and the full list", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    const second = { ...RECORD, name: "bob.xlm" };
    mockResponse({ indexed: true, domain: RECORD, domains: [RECORD, second] });

    await expect(fetchDomainsByAddress(ACCOUNT)).resolves.toEqual({
      available: true,
      data: { domain: RECORD, domains: [RECORD, second] },
    });
  });

  it("queries by address", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse({ indexed: true, domain: null, domains: [] });

    await fetchDomainsByAddress(ACCOUNT);

    expect(global.fetch).toHaveBeenCalledWith(
      `http://indexer/v1/domains?address=${ACCOUNT}`,
      expect.anything()
    );
  });

  it("strips a trailing slash from the configured base URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer/");
    mockResponse({ indexed: true, domain: null, domains: [] });

    await fetchDomainsByAddress(ACCOUNT);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("http://indexer/v1/domains"),
      expect.anything()
    );
  });

  it("returns error on a non-OK response", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    mockResponse({}, false);

    await expect(fetchDomainsByAddress(ACCOUNT)).resolves.toEqual({
      available: false,
      reason: "error",
    });
  });

  it("returns error when the request throws", async () => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_URL", "http://indexer");
    global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

    await expect(fetchDomainsByAddress(ACCOUNT)).resolves.toEqual({
      available: false,
      reason: "error",
    });
  });
});
