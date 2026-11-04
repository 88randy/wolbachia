import { describe, expect, test } from "vitest";
import { countCharacters, hasForbiddenCharacters, normalizeReason } from "./count-characters";

// The same cases as backend/tests/test_void_reason.py: the web only mirrors the server's rule.
const INVISIBLE = [
  "\u200b", // zero-width space
  "\u200d", // zero-width joiner
  "\ufeff", // BOM: trim() strips it, Python's strip() does not; neither may count
  "\u0301", // combining acute accent
  "\u00a0", // no-break space
  "\u2028", // line separator
  "\u3164", // Hangul filler
  "\u2800", // braille blank
  "\ue000", // private use
  "\u0378", // unassigned
];

describe("countCharacters", () => {
  test.each(INVISIBLE)("text that shows nothing (%j) does not count", (invisible) => {
    expect(countCharacters(normalizeReason(invisible.repeat(10)))).toBe(0);
    expect(countCharacters(normalizeReason(`abc${invisible.repeat(5)}`))).toBe(3);
  });

  test("line feeds are allowed in a reason but never count", () => {
    expect(countCharacters(normalizeReason("​" + "\n".repeat(10) + "​"))).toBe(0);
    expect(countCharacters(normalizeReason("ab" + "\n".repeat(8) + "cd"))).toBe(4);
  });

  test("accented letters and emoji count, one per code point as Python's len does", () => {
    expect(countCharacters(normalizeReason("anulaci\u00f3n"))).toBe(9);
    expect(countCharacters(normalizeReason("\u{1f600}a"))).toBe(2);
  });
});

describe("normalizeReason", () => {
  test("stores composed accents, LF line ends and no surrounding spaces", () => {
    expect(normalizeReason("  e\u0301\r\nx  ")).toBe("\u00e9\nx");
  });
});

describe("hasForbiddenCharacters", () => {
  test.each(["\u202eevil", "a\u2066b", "a\u0000b", "a\u0007b", "a\tb", "a\rb"])(
    "refuses control and bidi text (%j)",
    (text) => {
      expect(hasForbiddenCharacters(normalizeReason(text))).toBe(true);
    },
  );

  test("allows a line feed and ordinary text", () => {
    expect(
      hasForbiddenCharacters(normalizeReason("l\u00ednea uno\nl\u00ednea dos \u{1f600}")),
    ).toBe(false);
  });
});
