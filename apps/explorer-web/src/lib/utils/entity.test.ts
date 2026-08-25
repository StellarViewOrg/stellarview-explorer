import { describe, it, expect } from "vitest";
import { detectEntityType, getEntityRoute, isDomainName } from "./entity";

const ACCOUNT = "GA62IQXVM62EIMLR2Z63L3V2HLBF2RPCSXTQKPEHEGTR6ARVYW4SUKLF";
const CONTRACT = "CC75Z72OCE667WVPQOROIWDAGBOXFNJ4VQONQEURL74EYIDLWA4F7FEN";
const TX_HASH = "a".repeat(64);

describe("isDomainName", () => {
  it("accepts a domain and a subdomain", () => {
    expect(isDomainName("alice.xlm")).toBe(true);
    expect(isDomainName("pay.alice.xlm")).toBe(true);
  });

  it("is case and whitespace insensitive", () => {
    expect(isDomainName("  Alice.XLM  ")).toBe(true);
  });

  it("rejects anything outside the .xlm TLD", () => {
    expect(isDomainName("alice.eth")).toBe(false);
    expect(isDomainName("alice")).toBe(false);
    expect(isDomainName("xlm")).toBe(false);
    expect(isDomainName(".xlm")).toBe(false);
  });
});

describe("detectEntityType", () => {
  it("detects a domain", () => {
    expect(detectEntityType("alice.xlm")).toBe("domain");
  });

  it("still detects the existing entity types", () => {
    expect(detectEntityType(TX_HASH)).toBe("transaction");
    expect(detectEntityType(ACCOUNT)).toBe("account");
    expect(detectEntityType(CONTRACT)).toBe("contract");
    expect(detectEntityType("12345")).toBe("ledger");
    expect(detectEntityType(`USDC-${ACCOUNT}`)).toBe("asset");
    expect(detectEntityType("???")).toBe("unknown");
  });
});

describe("getEntityRoute", () => {
  it("has no route for a domain, which must be resolved first", () => {
    expect(getEntityRoute("domain", "alice.xlm")).toBeNull();
  });
});
