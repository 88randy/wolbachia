import { describe, expect, test, vi } from "vitest";
import { parseFlatSearch, stringifyFlatSearch } from "./flat-search";

describe("parseFlatSearch", () => {
  test("keeps every value as the exact string it was written", () => {
    expect(parseFlatSearch("?code=1e3&q=1.0&page=2&flag=true&zip=007")).toEqual({
      code: "1e3",
      q: "1.0",
      page: "2",
      flag: "true",
      zip: "007",
    });
  });

  test("works without the leading question mark and with an empty string", () => {
    expect(parseFlatSearch("a=b")).toEqual({ a: "b" });
    expect(parseFlatSearch("")).toEqual({});
  });

  test("a repeated key keeps the last value", () => {
    expect(parseFlatSearch("?a=1&a=2")).toEqual({ a: "2" });
  });

  test("a key named __proto__ is an own property, not the prototype", () => {
    const parsed = parseFlatSearch("?__proto__=x");

    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(Object.keys(parsed)).toEqual(["__proto__"]);
  });
});

describe("stringifyFlatSearch", () => {
  test("writes readable pairs, with numbers and booleans as text", () => {
    expect(
      stringifyFlatSearch({ status: "open", ordering: "-created_at", page: 2, on: true }),
    ).toBe("?status=open&ordering=-created_at&page=2&on=true");
  });

  test("does not quote strings that look like JSON", () => {
    expect(stringifyFlatSearch({ code: "4471" })).toBe("?code=4471");
  });

  test("leaves out undefined and null, and is empty when nothing is left", () => {
    expect(stringifyFlatSearch({ a: undefined, b: null })).toBe("");
  });

  test("an object or array throws in development and tests instead of vanishing", () => {
    expect(() => stringifyFlatSearch({ c: { d: 1 } })).toThrow(/"c" is an object or array/);
    expect(() => stringifyFlatSearch({ list: [1, 2] })).toThrow(TypeError);
  });

  test("in production it reports the problem and leaves the value out", () => {
    vi.stubEnv("PROD", true);
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(stringifyFlatSearch({ a: "1", c: { d: 1 } })).toBe("?a=1");
    expect(report).toHaveBeenCalledOnce();

    vi.unstubAllEnvs();
    report.mockRestore();
  });

  test("round-trips text with spaces and reserved characters", () => {
    const search = { q: "a b&c=d/é" };

    expect(parseFlatSearch(stringifyFlatSearch(search))).toEqual(search);
  });
});
