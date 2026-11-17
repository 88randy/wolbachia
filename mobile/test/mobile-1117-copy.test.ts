import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { distanceMessage } from "../src/features/day/format-distance.ts";
import { resolveScanner } from "../src/features/scanner/domain.ts";
import type { ScannerResource } from "../src/features/scanner/resource-source.ts";

const TRAP: ScannerResource = {
  kind: "ovitrap",
  id: "44444444-4444-4444-8444-444444444444",
  code: "Q-MER-01-B1-P1",
  shortCode: "OVT-0001",
};

void describe("distance wording", () => {
  void it("uses meters below a kilometer and whole kilometers above", () => {
    assert.deepEqual(distanceMessage(350.4, "es-MX"), {
      key: "field.day.distance",
      params: { meters: "350" },
    });
    const far = distanceMessage(1_014_491, "es-MX");
    assert.equal(far.key, "field.day.distanceKm");
    assert.match(far.params.km ?? "", /^1[,.\s]?014$/);
  });
});

void describe("typing the short ovitrap code when checking or replacing", () => {
  void it("finds the trap by OVT-0001 in any spelling, and still by the point code", () => {
    for (const typed of ["OVT-0001", "ovt1", "OVT-01", "Q-MER-01-B1-P1"]) {
      const result = resolveScanner({ value: typed, isManual: true, expected: "ovitrap" }, [TRAP]);
      assert.ok("resource" in result, typed);
      assert.equal(result.resource.id, TRAP.id);
      assert.equal(result.manualCapture, true);
    }
  });

  void it("does not match another number or a trap without a label code", () => {
    const other = resolveScanner({ value: "OVT-0002", isManual: true, expected: "ovitrap" }, [
      TRAP,
    ]);
    assert.deepEqual(other, { error: "unavailable" });
    const bare = resolveScanner({ value: "OVT-0001", isManual: true, expected: "ovitrap" }, [
      { ...TRAP, shortCode: null },
    ]);
    assert.deepEqual(bare, { error: "unavailable" });
  });
});
