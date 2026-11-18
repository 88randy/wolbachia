import { screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import type { Schemas } from "@wolbachia/api-client";
import { openCount, pageOf } from "../count-test-helpers";
import { pcrOriginLabel } from "./sample-origin";

function sample(overrides: Partial<Schemas["SampleSnapshot"]>): Schemas["SampleSnapshot"] {
  return {
    id: "00000000-0000-4000-8000-000000000041",
    code: "S-0001",
    center_id: "00000000-0000-4000-8000-000000000042",
    quadrant_id: null,
    reading_id: null,
    lot_id: null,
    release_id: null,
    bag_code: null,
    voided: false,
    receipt: null,
    attempts: [],
    result_status: "missing",
    created_at: "2026-11-12T15:00:00Z",
    ...overrides,
  } as Schemas["SampleSnapshot"];
}

async function openResults(rows: Schemas["SampleSnapshot"][]) {
  return openCount({
    path: "/lab/results",
    language: "en",
    permissions: ["sample.read", "reading.read", "catalog.read"],
    routes: { "GET /api/v1/wolbachia-samples/": () => pageOf(rows) },
  });
}

test("a sample from a bag shows the bag code that opens the origin; a lot or release shows text", async () => {
  await openResults([
    sample({ code: "S-0001", bag_code: "B-031", reading_id: "r-1" }),
    sample({ id: "00000000-0000-4000-8000-000000000043", code: "S-0002", lot_id: "l-1" }),
    sample({ id: "00000000-0000-4000-8000-000000000044", code: "S-0003", release_id: "x-1" }),
  ]);
  const fromBag = (await screen.findByText("S-0001")).closest("tr") as HTMLElement;
  expect(within(fromBag).getByRole("button", { name: "View origin of bag B-031" })).toBeDefined();
  const fromLot = screen.getByText("S-0002").closest("tr") as HTMLElement;
  expect(within(fromLot).getByText("Lot")).toBeDefined();
  expect(within(fromLot).queryByRole("button", { name: /View origin/ })).toBeNull();
  const fromRelease = screen.getByText("S-0003").closest("tr") as HTMLElement;
  expect(within(fromRelease).getByText("Release")).toBeDefined();
});

test("a PCR batch sample names its origin in the language of the user", () => {
  const entry = { origin_label_es: "Lote", origin_label_en: "Lot" } as Schemas["PcrSampleEntry"];
  expect(pcrOriginLabel(entry, "en")).toBe("Lot");
  expect(pcrOriginLabel(entry, "es-MX")).toBe("Lote");
  expect(pcrOriginLabel({ ...entry, origin_label_en: "" }, "en")).toBe("Lote");
});
