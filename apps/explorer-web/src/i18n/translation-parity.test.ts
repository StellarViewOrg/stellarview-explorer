import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every locale must define exactly the same set of keys.
 *
 * CI already counts keys per file, but a count only catches additions and
 * removals: swapping one key for another keeps the total identical while
 * leaving a locale broken at runtime, because next-intl throws on a missing
 * key. This compares the key paths themselves.
 */

const MESSAGES_DIR = join(__dirname, "../../messages");

type Messages = { [key: string]: string | Messages };

function keyPaths(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? keyPaths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );
}

function loadLocale(file: string): Messages {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, file), "utf8")) as Messages;
}

const localeFiles = readdirSync(MESSAGES_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort();

const REFERENCE = "en.json";

describe("translation parity", () => {
  it("ships more than one locale", () => {
    expect(localeFiles.length).toBeGreaterThan(1);
    expect(localeFiles).toContain(REFERENCE);
  });

  const referenceKeys = keyPaths(loadLocale(REFERENCE)).sort();

  for (const file of localeFiles.filter((f) => f !== REFERENCE)) {
    it(`${file} defines exactly the keys ${REFERENCE} does`, () => {
      const keys = keyPaths(loadLocale(file)).sort();

      // Reported as two explicit sets so a failure names the offending keys
      // instead of dumping the whole file.
      const missing = referenceKeys.filter((key) => !keys.includes(key));
      const extra = keys.filter((key) => !referenceKeys.includes(key));

      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });
  }
});
