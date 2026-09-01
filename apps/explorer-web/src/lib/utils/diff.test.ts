import { describe, it, expect } from "vitest";
import { diffLines } from "./diff";

describe("diffLines", () => {
  it("returns all unchanged lines for identical input", () => {
    const result = diffLines("a\nb\nc", "a\nb\nc");
    expect(result.every((l) => l.type === "unchanged")).toBe(true);
    expect(result.map((l) => l.text)).toEqual(["a", "b", "c"]);
  });

  it("detects an added line", () => {
    const result = diffLines("a\nb", "a\nb\nc");
    expect(result).toEqual([
      { type: "unchanged", text: "a" },
      { type: "unchanged", text: "b" },
      { type: "added", text: "c" },
    ]);
  });

  it("detects a removed line", () => {
    const result = diffLines("a\nb\nc", "a\nc");
    expect(result).toEqual([
      { type: "unchanged", text: "a" },
      { type: "removed", text: "b" },
      { type: "unchanged", text: "c" },
    ]);
  });

  it("handles a full replacement", () => {
    const result = diffLines("old line", "new line");
    expect(result).toEqual([
      { type: "removed", text: "old line" },
      { type: "added", text: "new line" },
    ]);
  });

  it("handles empty input on either side", () => {
    expect(diffLines("", "a")).toEqual([
      { type: "removed", text: "" },
      { type: "added", text: "a" },
    ]);
    expect(diffLines("a", "")).toEqual([
      { type: "removed", text: "a" },
      { type: "added", text: "" },
    ]);
  });
});
