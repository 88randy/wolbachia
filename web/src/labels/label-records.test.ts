import type { Schemas } from "@wolbachia/api-client";
import { describe, expect, it } from "vitest";
import { bagLabel, locationLabel, lotLabel, motorcycleLabel } from "./label-records";
import type { LabelText } from "./label-records";

const text: LabelText = {
  t: (key, params) => `${key}:${JSON.stringify(params ?? {})}`,
  calendarDate: (iso) => `cal(${iso})`,
  date: (iso) => `date(${iso})`,
};
const UUID = "0a1b2c3d-0000-4000-8000-0123456789ab";

describe("label content", () => {
  it("lot: code, item name and expiry; the id never appears", () => {
    const lot = {
      id: UUID,
      code: "L-0042",
      expiry_date: "2026-12-01",
      supply_version: { label: "Huevos de mosquito" },
    } as unknown as Schemas["Lot"];
    const record = lotLabel(lot, text);
    expect(record.code).toBe("L-0042");
    expect(record.lines[0]).toBe("Huevos de mosquito");
    expect(record.lines[1]).toContain("cal(2026-12-01)");
    expect(JSON.stringify(record)).not.toContain(UUID);
  });

  it("lot without expiry has only the item name", () => {
    const lot = {
      code: "L-1",
      expiry_date: null,
      supply_version: { label: "Insumo" },
    } as unknown as Schemas["Lot"];
    expect(lotLabel(lot, text).lines).toEqual(["Insumo"]);
  });

  it("location: name, then type and quadrant", () => {
    const location = {
      id: UUID,
      code: "A-01",
      name: "Almacén central",
      kind: "warehouse",
      quadrant_code: "Q-7",
    } as unknown as Schemas["Location"];
    const record = locationLabel(location, text);
    expect(record.lines[0]).toBe("Almacén central");
    expect(record.lines[1]).toContain("Q-7");
    expect(JSON.stringify(record)).not.toContain(UUID);
  });

  it("bag: its registration date; motorcycle: its plate", () => {
    expect(
      bagLabel({ code: "B-4471", createdAt: "2026-11-10T12:00:00Z" }, text).lines[0],
    ).toContain("date(2026-11-10T12:00:00Z)");
    expect(motorcycleLabel({ code: "M-03", plate: "ABC-123" }, text).lines[0]).toContain("ABC-123");
    expect(motorcycleLabel({ code: "M-03", plate: "" }, text).lines).toEqual([]);
  });
});
