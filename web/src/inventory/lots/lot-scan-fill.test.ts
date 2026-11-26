import { expect, test } from "vitest";
import { parseSupplierCode } from "../../scan/gs1";
import { patchFromSupplierCode } from "./lot-scan-fill";

test("a full supplier code fills lot, expiry and quantity", () => {
  const data = parseSupplierCode("(01)07501055300013(17)271231(10)LOT-42(30)120");
  expect(data).not.toBeNull();
  expect(patchFromSupplierCode(data!)).toEqual({
    values: { code: "LOT-42", expiry_date: "2027-12-31", quantity: "120" },
    fields: ["code", "expiry_date", "quantity"],
  });
});

test("a bare product barcode fills nothing but still names the product", () => {
  const data = parseSupplierCode("7501055300013");
  expect(data?.gtin).toBe("07501055300013");
  expect(patchFromSupplierCode(data!)).toEqual({ values: {}, fields: [] });
});

test("a zero quantity is not copied", () => {
  const data = parseSupplierCode("(01)07501055300013(37)0");
  expect(patchFromSupplierCode(data!).fields).toEqual([]);
});
