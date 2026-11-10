import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FuelError,
  efficiencyAdvisory,
  fuelEvent,
  validateFuel,
  validateFuelField,
  serverFuelAdvisory,
} from "../src/features/fuel/domain.ts";
import type { FuelDraft } from "../src/features/fuel/types.ts";

function draft(patch: Partial<FuelDraft> = {}): FuelDraft {
  return {
    eventId: "c0444078-87cb-45ca-b742-0619bb5bce45",
    ownerKey: "fuel-owner",
    shiftId: "5673ad58-c7b9-455b-b7c0-6d14cb4e883f",
    motorcycleCode: "M-03",
    deviceTime: "2026-11-09T15:00:00.000Z",
    catalogVersion: "catalog-fuel",
    rulesVersion: "rules-fuel",
    litres: "2.5",
    amount: "62.5",
    currency: "MXN",
    odometer: "12000",
    isFullRefill: true,
    receipt: null,
    ...patch,
  };
}

void test("M11 original server assessment renders its pinned thresholds without inventing missing metrics", () => {
  assert.deepEqual(
    serverFuelAdvisory({
      code: "fuel_efficiency_review",
      params: {
        efficiency_km_l: "14.999",
        threshold_min: "15.000",
        threshold_max: "60.000",
      },
    }),
    { kind: "review", efficiencyKmL: 14.999, minimum: 15, maximum: 60 },
  );
  assert.deepEqual(serverFuelAdvisory({ code: "odometer_decreased", params: {} }), {
    kind: "decreased",
    efficiencyKmL: null,
    minimum: null,
    maximum: null,
  });
  assert.equal(serverFuelAdvisory({ code: "accepted", params: {} }), null);
  assert.equal(
    serverFuelAdvisory({
      code: "fuel_efficiency_review",
      params: {
        efficiency_km_l: "NaN",
        threshold_min: "",
        threshold_max: false,
      },
    })?.efficiencyKmL,
    null,
  );
});

void test("M11 quantities retain raw input and enforce exact server Decimal and odometer limits", () => {
  const original = draft();
  assert.deepEqual(validateFuel(original), {
    litres: "2.500",
    amount: "62.50",
    currency: "MXN",
    odometer_km: 12000,
    is_full_refill: true,
  });
  assert.equal(original.litres, "2.5");
  const cases = [
    ["litres", "0", "litres_invalid"],
    ["litres", "-1", "litres_invalid"],
    ["litres", "NaN", "litres_invalid"],
    ["litres", "Infinity", "litres_invalid"],
    ["litres", "1e3", "litres_invalid"],
    ["litres", "0.0001", "litres_invalid"],
    ["litres", "1000000000", "litres_invalid"],
    ["amount", "0", "amount_invalid"],
    ["amount", "0.001", "amount_invalid"],
    ["amount", "1000000000000", "amount_invalid"],
    ["currency", "mxn", "currency_invalid"],
    ["currency", "MX", "currency_invalid"],
    ["odometer", "-1", "odometer_invalid"],
    ["odometer", "1.5", "odometer_invalid"],
    ["odometer", "1000000", "odometer_invalid"],
  ] as const;
  for (const [field, value, expected] of cases) {
    assert.equal(validateFuelField(field, value), expected, `${field}: ${value}`);
    assert.throws(
      () => validateFuel({ ...original, [field]: value }),
      (error) => error instanceof FuelError && error.code === expected,
    );
  }
  assert.equal(validateFuelField("litres", "0.001"), null);
  assert.equal(validateFuelField("amount", "999999999999.99"), null);
  assert.equal(validateFuelField("odometer", "0"), null);
  assert.equal(validateFuelField("odometer", "999999"), null);
  assert.equal(validateFuel(draft({ litres: "3" })).litres, "3.000");
});

void test("M11 event pins original shift motorcycle code and declares only the retained receipt", () => {
  const original = draft({
    receipt: { id: "3d5f6cbd-f823-4bc5-a046-fbbf87fb929b", fileRef: "private-receipt.jpg" },
  });
  const event = fuelEvent(original);
  assert.equal(event.id, original.eventId);
  assert.equal(event.type, "fuel.load");
  assert.equal(event.device_time, original.deviceTime);
  assert.equal(event.shift_id, original.shiftId);
  assert.equal(event.rules_version, original.rulesVersion);
  assert.equal(event.catalog_version, original.catalogVersion);
  assert.equal(event.manual_capture, true);
  assert.equal(event.gps, null);
  assert.deepEqual(event.payload, {
    motorcycle_id: "M-03",
    litres: "2.500",
    amount: "62.50",
    currency: "MXN",
    odometer_km: 12000,
    receipt_upload_id: original.receipt?.id,
    is_full_refill: true,
  });
  assert.equal(fuelEvent(draft()).payload.receipt_upload_id, null);
  assert.throws(() => fuelEvent(draft({ shiftId: "" })), FuelError);
});

const BASELINE = {
  deviceTime: "2026-11-08T15:00:00.000Z",
  odometer: 1000,
  isFullRefill: true,
  isAccepted: true,
};
const CURRENT = {
  deviceTime: "2026-11-09T15:00:00.000Z",
  odometer: 2000,
  litres: "100",
  isFullRefill: true,
};
const RULES = { minimum: 15, maximum: 60 };

void test("M11 unknown, partial, unaccepted and non-forward intervals never invent efficiency", () => {
  const cases = [
    { baseline: null, current: CURRENT },
    { baseline: { ...BASELINE, isAccepted: false }, current: CURRENT },
    { baseline: { ...BASELINE, isFullRefill: false }, current: CURRENT },
    { baseline: BASELINE, current: { ...CURRENT, isFullRefill: false } },
    { baseline: BASELINE, current: { ...CURRENT, deviceTime: BASELINE.deviceTime } },
    { baseline: BASELINE, current: { ...CURRENT, deviceTime: "2026-11-07T15:00:00.000Z" } },
  ];
  for (const interval of cases) {
    const advisory = efficiencyAdvisory({ ...interval, rules: RULES });
    assert.equal(advisory.kind, "insufficient");
    assert.equal(advisory.efficiencyKmL, null);
  }
  assert.equal(
    efficiencyAdvisory({ baseline: BASELINE, current: { ...CURRENT, odometer: 999 }, rules: RULES })
      .kind,
    "decreased",
  );
  assert.equal(CURRENT.odometer, 2000);
});

void test("M11 downloaded efficiency bounds are inclusive without rounding outliers into policy", () => {
  for (const [distance, expected] of [
    [1499, "review"],
    [1500, "ok"],
    [6000, "ok"],
    [6001, "review"],
  ] as const) {
    const advisory = efficiencyAdvisory({
      baseline: BASELINE,
      current: { ...CURRENT, odometer: BASELINE.odometer + distance },
      rules: RULES,
    });
    assert.equal(advisory.kind, expected);
    assert.equal(advisory.efficiencyKmL, distance / 100);
  }
  const exactDecimal = efficiencyAdvisory({
    baseline: { ...BASELINE, odometer: 0 },
    current: { ...CURRENT, litres: "0.200", odometer: 3 },
    rules: RULES,
  });
  assert.equal(exactDecimal.kind, "ok");
  assert.equal(exactDecimal.efficiencyKmL, 15);
  for (const rules of [null, { minimum: null, maximum: 60 }, { minimum: 60, maximum: 15 }]) {
    assert.equal(
      efficiencyAdvisory({ baseline: BASELINE, current: CURRENT, rules }).kind,
      "unconfigured",
    );
  }
});
