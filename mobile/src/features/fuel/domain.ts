import type { EventResult, FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import type {
  FuelDraft,
  FuelErrorCode,
  FuelField,
  FuelValues,
  FuelAdvisory,
  FuelBaseline,
  FuelCurrent,
  FuelEfficiencyRules,
} from "./types.ts";

const LITRES_PRECISION = 3;
const AMOUNT_PRECISION = 2;
const LITRES_WHOLE_DIGITS = 9;
const AMOUNT_WHOLE_DIGITS = 12;
const DECIMAL_SCALE = 1000n;
const MAX_ODOMETER_KM = 999999;

export class FuelError extends Error {
  readonly code: FuelErrorCode;
  constructor(code: FuelErrorCode) {
    super(code);
    this.name = "FuelError";
    this.code = code;
  }
}
/** Decimal text is normalized exactly; the editable draft always keeps its original strings. */
function decimalValue(value: string, precision: number, wholeDigits: number): string | null {
  const text = value.trim();
  const pattern = new RegExp(
    `^(?:0|[1-9]\\d{0,${String(wholeDigits - 1)}})(?:\\.\\d{1,${String(precision)}})?$`,
  );
  if (!pattern.test(text) || !/[1-9]/.test(text)) return null;
  const [whole = "", fraction = ""] = text.split(".");
  return `${whole}.${fraction.padEnd(precision, "0")}`;
}
function odometerValue(value: string): number | null {
  const text = value.trim();
  if (!/^\d{1,6}$/.test(text)) return null;
  const parsed = Number(text);
  return parsed <= MAX_ODOMETER_KM ? parsed : null;
}
/** Blur validation and Save use the same parser and coded recovery path. */
export function validateFuelField(field: FuelField, value: string): FuelErrorCode | null {
  switch (field) {
    case "litres":
      return decimalValue(value, LITRES_PRECISION, LITRES_WHOLE_DIGITS) === null
        ? "litres_invalid"
        : null;
    case "amount":
      return decimalValue(value, AMOUNT_PRECISION, AMOUNT_WHOLE_DIGITS) === null
        ? "amount_invalid"
        : null;
    case "currency":
      return /^[A-Z]{3}$/.test(value) ? null : "currency_invalid";
    case "odometer":
      return odometerValue(value) === null ? "odometer_invalid" : null;
  }
}
export function validateFuel(draft: FuelDraft): FuelValues {
  for (const field of ["litres", "amount", "currency", "odometer"] as const) {
    const code = validateFuelField(field, draft[field]);
    if (code !== null) throw new FuelError(code);
  }
  return {
    litres: decimalValue(draft.litres, LITRES_PRECISION, LITRES_WHOLE_DIGITS) ?? "",
    amount: decimalValue(draft.amount, AMOUNT_PRECISION, AMOUNT_WHOLE_DIGITS) ?? "",
    currency: draft.currency,
    odometer_km: odometerValue(draft.odometer) ?? 0,
    is_full_refill: draft.isFullRefill,
  };
}
export function fuelEvent(draft: FuelDraft): FieldEventEnvelope {
  if (!draft.shiftId || !draft.motorcycleCode || !draft.rulesVersion || !draft.catalogVersion)
    throw new FuelError("context_unavailable");
  return {
    id: draft.eventId,
    type: "fuel.load",
    schema_version: 1,
    device_time: draft.deviceTime,
    shift_id: draft.shiftId,
    gps: null,
    rules_version: draft.rulesVersion,
    catalog_version: draft.catalogVersion,
    manual_capture: true,
    voids_event_id: null,
    payload: {
      motorcycle_id: draft.motorcycleCode,
      ...validateFuel(draft),
      receipt_upload_id: draft.receipt?.id ?? null,
    },
  };
}
function comparable(baseline: FuelBaseline | null, current: FuelCurrent): baseline is FuelBaseline {
  return (
    baseline !== null &&
    baseline.isAccepted &&
    baseline.isFullRefill &&
    current.isFullRefill &&
    Date.parse(current.deviceTime) > Date.parse(baseline.deviceTime) &&
    Number.isSafeInteger(baseline.odometer) &&
    Number.isSafeInteger(current.odometer)
  );
}
function configured(
  rules: FuelEfficiencyRules | null,
): rules is { minimum: number; maximum: number } {
  if (rules?.minimum == null || rules.maximum === null) return false;
  return (
    Number.isFinite(rules.minimum) &&
    Number.isFinite(rules.maximum) &&
    rules.minimum > 0 &&
    rules.maximum > rules.minimum &&
    Number(rules.minimum.toFixed(LITRES_PRECISION)) === rules.minimum &&
    Number(rules.maximum.toFixed(LITRES_PRECISION)) === rules.maximum
  );
}
function decimalUnits(canonical: string): bigint {
  return BigInt(canonical.replace(".", ""));
}

function serverDecimal(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
/** Original server calculation facts, never a reconstruction from incomplete local history. */
export function serverFuelAdvisory(result: EventResult | null): FuelAdvisory | null {
  if (result === null || !["fuel_efficiency_review", "odometer_decreased"].includes(result.code))
    return null;
  return {
    kind: result.code === "odometer_decreased" ? "decreased" : "review",
    efficiencyKmL: serverDecimal(result.params.efficiency_km_l),
    minimum: serverDecimal(result.params.threshold_min),
    maximum: serverDecimal(result.params.threshold_max),
  };
}
/** Cross multiplication applies downloaded bounds before any display rounding. */
function outsideBounds(
  distance: number,
  litres: string,
  rules: { minimum: number; maximum: number },
) {
  const distanceUnits = BigInt(distance) * DECIMAL_SCALE * DECIMAL_SCALE;
  const litresUnits = decimalUnits(litres);
  return (
    distanceUnits < litresUnits * decimalUnits(rules.minimum.toFixed(LITRES_PRECISION)) ||
    distanceUnits > litresUnits * decimalUnits(rules.maximum.toFixed(LITRES_PRECISION))
  );
}
/** Unknown history and missing downloaded policy remain explicit; no advisory blocks Save. */
export function efficiencyAdvisory(input: {
  readonly baseline: FuelBaseline | null;
  readonly current: FuelCurrent;
  readonly rules: FuelEfficiencyRules | null;
}): FuelAdvisory {
  const { baseline, current, rules } = input;
  const empty = {
    efficiencyKmL: null,
    minimum: rules?.minimum ?? null,
    maximum: rules?.maximum ?? null,
  };
  const litres = decimalValue(current.litres, LITRES_PRECISION, LITRES_WHOLE_DIGITS);
  if (litres === null || !comparable(baseline, current)) return { ...empty, kind: "insufficient" };
  const distance = current.odometer - baseline.odometer;
  if (distance < 0) return { ...empty, kind: "decreased" };
  if (!configured(rules)) return { ...empty, kind: "unconfigured" };
  return {
    ...empty,
    kind: outsideBounds(distance, litres, rules) ? "review" : "ok",
    efficiencyKmL: distance / Number(litres),
  };
}
