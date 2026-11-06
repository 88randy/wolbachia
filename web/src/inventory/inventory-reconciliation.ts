import type { InventoryRecord } from "./inventory-links";
import type { RetainedAttempt } from "./use-inventory-draft";
const decimals = new Set([
  "quantity",
  "estimated_organism_count",
  "temperature_min",
  "temperature_max",
  "humidity_min",
  "humidity_max",
]);
function exactDecimal(value: string) {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole = "", fraction = ""] = unsigned.split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  const tail = fraction.replace(/0+$/, "");
  const sign = negative && (integer !== "0" || tail !== "") ? "-" : "";
  return sign + integer + (tail ? "." + tail : "");
}
function comparable(key: string, value: string) {
  return decimals.has(key) && /^-?\d+(?:\.\d+)?$/.test(value) ? exactDecimal(value) : value.trim();
}
function objectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sameArray(expected: readonly unknown[], actual: unknown, key: string): boolean {
  return (
    Array.isArray(actual) &&
    expected.length === actual.length &&
    expected.every((value, index) => sameValue(value, actual[index], key))
  );
}
function sameObject(expected: Record<string, unknown>, actual: unknown): boolean {
  return (
    objectValue(actual) &&
    Object.entries(expected).every(([key, value]) => sameValue(value, actual[key], key))
  );
}
function sameValue(expected: unknown, actual: unknown, key: string): boolean {
  if (typeof expected === "string" && typeof actual === "string")
    return comparable(key, expected) === comparable(key, actual);
  if (Array.isArray(expected)) return sameArray(expected, actual, key);
  if (objectValue(expected)) return sameObject(expected, actual);
  return expected === actual;
}
/** Only FK aliases differ between generated read and write projections. */
function returnedFields(record: InventoryRecord) {
  const fields: Record<string, unknown> = { ...record };
  if ("center" in record) fields["center_id"] = record.center;
  if ("quadrant" in record) fields["quadrant_id"] = record.quadrant;
  if ("supply" in record) fields["supply_id"] = record.supply;
  return fields;
}
/** Confirm the immutable sent command; later changes to unsubmitted fields are irrelevant. */
export function matchesInventoryAttempt(
  attempt: RetainedAttempt,
  current: InventoryRecord | null,
  base: string,
): current is InventoryRecord {
  const { command } = attempt;
  if (!current || attempt.base !== base) return false;
  if (command.id !== undefined && command.id !== current.id) return false;
  if (command.body.code !== current.code || current.revision <= command.body.expected_revision)
    return false;
  const sent: Record<string, unknown> = { ...command.body };
  const actual = returnedFields(current);
  return Object.entries(sent)
    .filter(([key]) => key !== "expected_revision")
    .every(([key, value]) => sameValue(value, actual[key], key));
}
