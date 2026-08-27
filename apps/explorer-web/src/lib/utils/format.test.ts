import { describe, it, expect } from "vitest";
import {
  truncateHash,
  stroopsToXLM,
  formatNumber,
  formatCompactNumber,
  parseAssetString,
  buildPairSlug,
  parsePairSlug,
  paginate,
  parseSacAssetName,
} from "./format";

describe("truncateHash", () => {
  it("truncates long hashes", () => {
    const hash = "GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOP";
    const result = truncateHash(hash);
    expect(result).toContain("...");
    expect(result.startsWith("GABCDEFG")).toBe(true);
  });

  it("returns short strings as-is", () => {
    expect(truncateHash("short")).toBe("short");
  });

  it("respects custom lengths", () => {
    const hash = "GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOP";
    const result = truncateHash(hash, 4, 4);
    expect(result).toBe("GABC...MNOP");
  });
});

describe("stroopsToXLM", () => {
  it("converts stroops to XLM", () => {
    expect(stroopsToXLM(10000000)).toBe("1");
    expect(stroopsToXLM("10000000")).toBe("1");
  });

  it("handles decimal amounts", () => {
    expect(stroopsToXLM(5000000)).toBe("0.5");
    expect(stroopsToXLM(100)).toBe("0.00001");
  });

  it("handles zero", () => {
    expect(stroopsToXLM(0)).toBe("0");
  });
});

describe("formatNumber", () => {
  it("formats numbers with locale", () => {
    const result = formatNumber(1234567);
    expect(result).toContain("1");
    expect(result).toContain("234");
    expect(result).toContain("567");
  });

  it("handles string input", () => {
    const result = formatNumber("1234.5678");
    expect(result).toContain("1");
  });
});

describe("formatCompactNumber", () => {
  it("formats millions", () => {
    const result = formatCompactNumber(1500000);
    expect(result).toContain("1.5");
    expect(result).toContain("M");
  });

  it("formats thousands", () => {
    const result = formatCompactNumber(1500);
    expect(result).toContain("1.5");
    expect(result).toContain("K");
  });
});

describe("parseAssetString", () => {
  it("parses native asset", () => {
    expect(parseAssetString("native")).toEqual({ code: "XLM", issuer: null, isNative: true });
    expect(parseAssetString("XLM")).toEqual({ code: "XLM", issuer: null, isNative: true });
  });

  it("parses asset with issuer", () => {
    const result = parseAssetString(
      "USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
    );
    expect(result.code).toBe("USDC");
    expect(result.issuer).toBe("GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
    expect(result.isNative).toBe(false);
  });

  it("parses code-only asset", () => {
    const result = parseAssetString("USDC");
    expect(result.code).toBe("USDC");
    expect(result.issuer).toBeNull();
    expect(result.isNative).toBe(false);
  });
});

describe("buildPairSlug / parsePairSlug", () => {
  const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
  const AQUA_ISSUER = "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA";

  it("round-trips a native/credit pair", () => {
    const slug = buildPairSlug(
      { code: "XLM", issuer: "native" },
      { code: "USDC", issuer: USDC_ISSUER }
    );
    expect(slug).toBe(`XLM-native_USDC-${USDC_ISSUER}`);
    expect(parsePairSlug(slug)).toEqual({
      base: { code: "XLM", issuer: "native" },
      counter: { code: "USDC", issuer: USDC_ISSUER },
    });
  });

  it("round-trips a credit/credit pair", () => {
    const slug = buildPairSlug(
      { code: "USDC", issuer: USDC_ISSUER },
      { code: "AQUA", issuer: AQUA_ISSUER }
    );
    expect(parsePairSlug(slug)).toEqual({
      base: { code: "USDC", issuer: USDC_ISSUER },
      counter: { code: "AQUA", issuer: AQUA_ISSUER },
    });
  });

  it("returns null for malformed slugs", () => {
    expect(parsePairSlug("not-a-pair")).toBeNull();
    expect(parsePairSlug("XLM-native_USDC-tooshort")).toBeNull();
    expect(parsePairSlug("XLM-native_USDC-issuer_extra")).toBeNull();
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 45 }, (_, i) => i);

  it("returns the first page by default", () => {
    const result = paginate(items, 0, 20);
    expect(result.items).toEqual(items.slice(0, 20));
    expect(result.pageCount).toBe(3);
    expect(result.currentPage).toBe(0);
  });

  it("returns a middle page", () => {
    const result = paginate(items, 1, 20);
    expect(result.items).toEqual(items.slice(20, 40));
    expect(result.currentPage).toBe(1);
  });

  it("returns a partial last page", () => {
    const result = paginate(items, 2, 20);
    expect(result.items).toEqual(items.slice(40, 45));
    expect(result.items).toHaveLength(5);
  });

  it("clamps a page index beyond the available pages (e.g. after filtering shrinks the list)", () => {
    const result = paginate(items, 10, 20);
    expect(result.currentPage).toBe(2);
    expect(result.items).toEqual(items.slice(40, 45));
  });

  it("clamps a negative page index to 0", () => {
    const result = paginate(items, -1, 20);
    expect(result.currentPage).toBe(0);
  });

  it("returns one empty page for an empty list", () => {
    const result = paginate<number>([], 0, 20);
    expect(result).toEqual({ items: [], pageCount: 1, currentPage: 0 });
  });
});

describe("parseSacAssetName", () => {
  it('parses "native" as XLM', () => {
    expect(parseSacAssetName("native")).toEqual({ code: "XLM", issuer: "native" });
  });

  it("parses a CODE:ISSUER classic asset name", () => {
    const issuer = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
    expect(parseSacAssetName(`USDC:${issuer}`)).toEqual({ code: "USDC", issuer });
  });

  it("returns null for a name that isn't a classic-asset SAC (e.g. an arbitrary WASM token)", () => {
    expect(parseSacAssetName("My Custom Token")).toBeNull();
    expect(parseSacAssetName("USDC")).toBeNull();
    expect(parseSacAssetName("USDC:tooshort")).toBeNull();
  });
});
