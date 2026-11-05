import { describe, expect, test } from "vitest";
import { createVersionSchema, rangeKeyOf, valueIssueOf } from "./version-schema";
import type { ValueBounds } from "./version-schema";

const INTEGER_0_TO_500: ValueBounds = { min: 0, max: 500, isInteger: true };
const DECIMAL_FROM_1: ValueBounds = { min: 1, max: null, isInteger: false };
const DECIMAL_UP_TO_9: ValueBounds = { min: null, max: 9, isInteger: false };

describe("valueIssueOf (the same checks as the server's validate_value)", () => {
  test.each<{ name: string; typed: string; bounds: ValueBounds; expected: string | undefined }>([
    {
      name: "nothing typed",
      typed: "  ",
      bounds: INTEGER_0_TO_500,
      expected: "rules.error.valueRequired",
    },
    {
      name: "not a number",
      typed: "seis",
      bounds: INTEGER_0_TO_500,
      expected: "rules.error.valueInvalid",
    },
    {
      name: "more than 3 decimals",
      typed: "1.2345",
      bounds: DECIMAL_FROM_1,
      expected: "rules.error.valueInvalid",
    },
    {
      name: "a comma as decimal separator",
      typed: "1,5",
      bounds: DECIMAL_FROM_1,
      expected: "rules.error.valueInvalid",
    },
    {
      name: "a fraction for an integer",
      typed: "6.5",
      bounds: INTEGER_0_TO_500,
      expected: "rules.error.notInteger",
    },
    {
      name: "below the minimum",
      typed: "-1",
      bounds: INTEGER_0_TO_500,
      expected: "rules.error.range",
    },
    {
      name: "above the maximum",
      typed: "501",
      bounds: INTEGER_0_TO_500,
      expected: "rules.error.range",
    },
    {
      name: "below a minimum with no maximum",
      typed: "0.5",
      bounds: DECIMAL_FROM_1,
      expected: "rules.error.atLeast",
    },
    {
      name: "above a maximum with no minimum",
      typed: "9.5",
      bounds: DECIMAL_UP_TO_9,
      expected: "rules.error.atMost",
    },
    { name: "exactly the minimum", typed: "0", bounds: INTEGER_0_TO_500, expected: undefined },
    { name: "exactly the maximum", typed: "500", bounds: INTEGER_0_TO_500, expected: undefined },
    {
      name: "a whole number with spaces around it",
      typed: " 6 ",
      bounds: INTEGER_0_TO_500,
      expected: undefined,
    },
    {
      name: "3 decimals for a decimal parameter",
      typed: "2.125",
      bounds: DECIMAL_FROM_1,
      expected: undefined,
    },
  ])("$name", ({ typed, bounds, expected }) => {
    expect(valueIssueOf(typed, bounds)).toBe(expected);
  });
});

describe("rangeKeyOf", () => {
  test("names the limit that exists", () => {
    expect(rangeKeyOf(1, 9)).toBe("rules.error.range");
    expect(rangeKeyOf(1, null)).toBe("rules.error.atLeast");
    expect(rangeKeyOf(null, 9)).toBe("rules.error.atMost");
  });
});

describe("createVersionSchema", () => {
  const schema = createVersionSchema(INTEGER_0_TO_500);
  const valid = { value: "6", effectiveFrom: "2026-11-10", reason: "Ajuste acordado" };
  const messageOf = (input: object) => schema.safeParse(input).error?.issues[0]?.message;

  test("accepts a complete, valid version", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  test.each([
    ["no date", { effectiveFrom: "" }, "rules.error.dateRequired"],
    ["a reason of only spaces", { reason: "   " }, "rules.error.reasonRequired"],
    ["a reason over 1000 characters", { reason: "x".repeat(1001) }, "rules.error.reasonTooLong"],
    ["an out of range value", { value: "900" }, "rules.error.range"],
  ])("refuses %s with its catalog key", (_case, change, expected) => {
    expect(messageOf({ ...valid, ...change })).toBe(expected);
  });
});
