import { describe, expect, test } from "vitest";
import { readScan, targetFor } from "./scan-label";

const ID = "0a1b2c3d-0000-4000-8000-0123456789ab";
const GTIN = "07501055300013";

describe("readScan", () => {
  test("a label with a human code", () => {
    expect(readScan("wbf:1:lot:L-0001")).toEqual({
      form: "label",
      kind: "lot",
      ref: { by: "code", code: "L-0001" },
    });
  });
  test("a label with an id (W19 and mobile)", () => {
    expect(readScan(` wbf:1:bag:${ID.toUpperCase()} `)).toEqual({
      form: "label",
      kind: "bag",
      ref: { by: "id", id: ID },
    });
  });
  test("a bare human code", () => {
    expect(readScan("B-4471")).toEqual({ form: "plain", code: "B-4471" });
  });
  test("a GS1 string", () => {
    const reading = readScan(`(01)${GTIN}(10)L1`);
    expect(reading.form).toBe("gs1");
  });
  test("a label of another version is just text", () => {
    expect(readScan("wbf:2:lot:L-1").form).toBe("plain");
  });
});

describe("targetFor", () => {
  test("code labels, id labels and plain codes", () => {
    expect(targetFor(readScan("wbf:1:lot:L-0001"), "lot")).toEqual({
      status: "code",
      code: "L-0001",
    });
    expect(targetFor(readScan(`wbf:1:lot:${ID}`), "lot")).toEqual({
      status: "id",
      id: ID,
      kind: "lot",
    });
    expect(targetFor(readScan("L-0001"), "lot")).toEqual({ status: "code", code: "L-0001" });
  });
  test("a label of another kind is refused with the kind it is", () => {
    expect(targetFor(readScan("wbf:1:motorcycle:M-1"), "lot")).toEqual({
      status: "wrongKind",
      found: "motorcycle",
    });
    expect(targetFor(readScan(`wbf:1:lot:${ID}`), "bag")).toEqual({
      status: "wrongKind",
      found: "lot",
    });
  });
  test("GS1 is a supplier code only where accepted", () => {
    const text = `(01)${GTIN}(10)L1`;
    expect(targetFor(readScan(text), "lot", true)).toEqual({ status: "supplier", text });
    expect(targetFor(readScan(text), "lot")).toEqual({ status: "code", code: text });
  });
});
