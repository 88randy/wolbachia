import { describe, expect, test } from "vitest";
import { countValue } from "./count-value";
describe("authored egg count input", () => {
  test.each(["", "-1", "1.5", "1e3", "Infinity", "9007199254740992"])("rejects %j without rounding", (text) => {
    expect(countValue(text)).toBeUndefined();
  });
  test.each([["0", 0], ["0012", 12], ["9007199254740991", Number.MAX_SAFE_INTEGER]] as const)("accepts %s as an exact observation", (text, expected) => {
    expect(countValue(text)).toBe(expected);
  });
});
