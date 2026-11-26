import { describe, expect, test } from "vitest";
import { isValidGtin, parseGs1, parseSupplierCode, toGtin14 } from "./gs1";

const GS = "\u001d";
const GTIN = "07501055300013";

describe("isValidGtin", () => {
  test("accepts GTIN-8, 12, 13 and 14 with a right check digit", () => {
    expect(isValidGtin("12345670")).toBe(true);
    expect(isValidGtin("036000291452")).toBe(true);
    expect(isValidGtin("7501055300013")).toBe(true);
    expect(isValidGtin(GTIN)).toBe(true);
  });
  test("refuses a wrong check digit, wrong length and letters", () => {
    expect(isValidGtin("7501055300014")).toBe(false);
    expect(isValidGtin("12345")).toBe(false);
    expect(isValidGtin("75010553000A3")).toBe(false);
  });
  test("pads to GTIN-14", () => {
    expect(toGtin14("7501055300013")).toBe(GTIN);
  });
});

describe("parseGs1 parenthesized", () => {
  test("reads GTIN, lot, expiry, production date and quantity", () => {
    expect(parseGs1(`(01)${GTIN}(11)260105(17)271231(10)LOT-42(30)120`)).toEqual({
      gtin: GTIN,
      lot: "LOT-42",
      expiryDate: "2027-12-31",
      productionDate: "2026-01-05",
      quantity: "120",
    });
  });
  test("uses (37) when (30) is absent and drops leading zeros", () => {
    expect(parseGs1(`(01)${GTIN}(37)000024`)?.quantity).toBe("24");
  });
  test("day 00 means the last day of the month", () => {
    expect(parseGs1(`(01)${GTIN}(17)280200`)?.expiryDate).toBe("2028-02-29");
  });
});

describe("parseGs1 raw with separators", () => {
  test("a variable lot in the middle ends at the group separator", () => {
    expect(parseGs1(`01${GTIN}10LOT42${GS}17271231`)).toMatchObject({
      gtin: GTIN,
      lot: "LOT42",
      expiryDate: "2027-12-31",
    });
  });
  test("a variable lot at the end needs no separator", () => {
    expect(parseGs1(`01${GTIN}17271231ABC`)).toBeNull();
    expect(parseGs1(`01${GTIN}1727123110ABC`)).toMatchObject({ lot: "ABC" });
  });
  test("accepts the symbology identifier a scanner may prepend", () => {
    expect(parseGs1(`]C101${GTIN}10X1`)).toMatchObject({ gtin: GTIN, lot: "X1" });
    expect(parseGs1(`]d201${GTIN}10X1`)).toMatchObject({ gtin: GTIN, lot: "X1" });
  });
  test("a measure AI such as (3103) is skipped over", () => {
    expect(parseGs1(`01${GTIN}310300150010K9`)).toMatchObject({ lot: "K9" });
  });
});

describe("parseGs1 refusals", () => {
  test.each([
    ["a plain label code", "L-0001"],
    ["a plain number", "123456"],
    ["empty text", "   "],
    ["a wrong GTIN check digit", "(01)07501055300014(10)A"],
    ["an unknown AI", "(99)ABC"],
    ["a fixed field that is too short", "0107501"],
    ["a lot that is too long", `01${GTIN}10${"A".repeat(21)}`],
    ["text before the parentheses", "x(10)A"],
  ])("%s", (_name, text) => {
    expect(parseGs1(text)).toBeNull();
  });
  test("an impossible date is dropped but the other fields stay", () => {
    expect(parseGs1(`(01)${GTIN}(17)271331(10)A`)?.expiryDate).toBeNull();
  });
});

describe("parseSupplierCode", () => {
  test("a bare retail barcode is only the product number", () => {
    expect(parseSupplierCode("7501055300013")).toEqual({
      gtin: GTIN,
      lot: null,
      expiryDate: null,
      productionDate: null,
      quantity: null,
    });
  });
  test("a GS1 string still reads as GS1", () => {
    expect(parseSupplierCode(`(01)${GTIN}(10)L1`)).toMatchObject({ gtin: GTIN, lot: "L1" });
  });
  test("our own label codes are not supplier codes", () => {
    expect(parseSupplierCode("LOT-0042")).toBeNull();
  });
});
