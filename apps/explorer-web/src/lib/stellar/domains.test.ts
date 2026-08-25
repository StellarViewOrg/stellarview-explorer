import { describe, it, expect, vi, beforeEach } from "vitest";
import { NETWORKS } from "@/lib/constants";

const mockSearchDomain = vi.fn();
const mockConstructor = vi.fn();

vi.mock("@creit-tech/sorobandomains-sdk", () => ({
  SorobanDomainsSDK: class {
    constructor(params: unknown) {
      mockConstructor(params);
    }
    searchDomain = mockSearchDomain;
  },
}));

vi.mock("@/lib/observability", () => ({ reportError: vi.fn() }));

import { resolveDomain, normalizeDomainName } from "./domains";
import { reportError } from "@/lib/observability";

const ACCOUNT = "GA62IQXVM62EIMLR2Z63L3V2HLBF2RPCSXTQKPEHEGTR6ARVYW4SUKLF";
const CONTRACT = "CC75Z72OCE667WVPQOROIWDAGBOXFNJ4VQONQEURL74EYIDLWA4F7FEN";

/** Far enough out that the fixture doesn't rot. */
const NOT_EXPIRED = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
const EXPIRED = Math.floor(Date.now() / 1000) - 60;

describe("normalizeDomainName", () => {
  it("trims and lowercases, since the registry only accepts lowercase", () => {
    expect(normalizeDomainName("  Alice.XLM ")).toBe("alice.xlm");
  });
});

describe("resolveDomain", () => {
  beforeEach(() => {
    mockSearchDomain.mockReset();
    mockConstructor.mockReset();
    vi.mocked(reportError).mockClear();
  });

  it("resolves a domain to an account", async () => {
    mockSearchDomain.mockResolvedValue({ address: ACCOUNT, exp_date: NOT_EXPIRED });

    await expect(resolveDomain("mainnet", "alice.xlm")).resolves.toEqual({
      status: "resolved",
      name: "alice.xlm",
      address: ACCOUNT,
      targetType: "account",
    });
  });

  it("resolves a domain to a contract", async () => {
    mockSearchDomain.mockResolvedValue({ address: CONTRACT, exp_date: NOT_EXPIRED });

    const result = await resolveDomain("mainnet", "alice.xlm");

    expect(result).toMatchObject({ status: "resolved", targetType: "contract" });
  });

  it("resolves a subdomain", async () => {
    mockSearchDomain.mockResolvedValue({ address: ACCOUNT, exp_date: NOT_EXPIRED });

    await resolveDomain("mainnet", "pay.alice.xlm");

    expect(mockSearchDomain).toHaveBeenCalledWith("pay.alice.xlm");
  });

  it("lowercases the name before hitting the registry", async () => {
    mockSearchDomain.mockResolvedValue({ address: ACCOUNT, exp_date: NOT_EXPIRED });

    await resolveDomain("mainnet", "Alice.XLM");

    expect(mockSearchDomain).toHaveBeenCalledWith("alice.xlm");
  });

  it("uses the explorer's own RPC, never the SDK's third-party default", async () => {
    mockSearchDomain.mockResolvedValue({ address: ACCOUNT, exp_date: NOT_EXPIRED });

    await resolveDomain("mainnet", "alice.xlm");

    expect(mockConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ rpcUrl: NETWORKS.mainnet.rpcUrl })
    );
  });

  it("reports an unregistered domain as not found, without reporting an error", async () => {
    mockSearchDomain.mockRejectedValue(new Error("RecordDoesntExist"));

    await expect(resolveDomain("mainnet", "nope.xlm")).resolves.toEqual({
      status: "not_found",
      name: "nope.xlm",
    });
    expect(reportError).not.toHaveBeenCalled();
  });

  it("treats a malformed name rejected by the registry as not found", async () => {
    mockSearchDomain.mockRejectedValue(new Error("InvalidDomain"));

    await expect(resolveDomain("mainnet", "a--b.xlm")).resolves.toMatchObject({
      status: "not_found",
    });
    expect(reportError).not.toHaveBeenCalled();
  });

  it("reports an expired registration from the registry error", async () => {
    mockSearchDomain.mockRejectedValue(new Error("RecordIsExpired"));

    await expect(resolveDomain("mainnet", "old.xlm")).resolves.toMatchObject({
      status: "expired",
    });
    expect(reportError).not.toHaveBeenCalled();
  });

  it("reports an expired registration from a stale record's exp_date", async () => {
    mockSearchDomain.mockResolvedValue({ address: ACCOUNT, exp_date: EXPIRED });

    await expect(resolveDomain("mainnet", "old.xlm")).resolves.toMatchObject({
      status: "expired",
    });
  });

  it("returns a generic error and reports the cause when the RPC fails", async () => {
    mockSearchDomain.mockRejectedValue(new Error("simulation failed: host invocation trapped"));

    const result = await resolveDomain("mainnet", "alice.xlm");

    expect(result).toEqual({ status: "error", name: "alice.xlm" });
    expect(reportError).toHaveBeenCalled();
  });

  it("never leaks the raw contract error into the result", async () => {
    const raw = "HostError: Error(Contract, #42) escalating to VM trap";
    mockSearchDomain.mockRejectedValue(new Error(raw));

    const result = await resolveDomain("mainnet", "alice.xlm");

    expect(JSON.stringify(result)).not.toContain(raw);
  });

  it("rejects an invalid address coming back from the registry", async () => {
    mockSearchDomain.mockResolvedValue({ address: "not-an-address", exp_date: NOT_EXPIRED });

    const result = await resolveDomain("mainnet", "alice.xlm");

    expect(result).toMatchObject({ status: "error" });
    expect(reportError).toHaveBeenCalled();
  });

  it("reports the feature as unsupported on a network with no registry", async () => {
    await expect(resolveDomain("futurenet", "alice.xlm")).resolves.toEqual({
      status: "unsupported",
      name: "alice.xlm",
    });
    expect(mockSearchDomain).not.toHaveBeenCalled();
  });
});
