/**
 * What a scanned text can be. One pure module, so every screen reads labels the same way:
 * - `wbf:1:<kind>:<human code>`  (printed labels), e.g. `wbf:1:lot:L-0001`
 * - `wbf:1:<kind>:<uuid>`        (W19 labels and the mobile app): resolved by id
 * - a bare human code            (typed, or a plain barcode)
 * - a GS1 string                 (supplier labels; see `gs1.ts`)
 */
import { parseSupplierCode } from "./gs1";
import type { Gs1Data } from "./gs1";

/** The record types a screen can ask for. */
export type ScanExpect = "lot" | "bag";

export type LabelRef = { by: "id"; id: string } | { by: "code"; code: string };

export type ScanReading =
  | { form: "label"; kind: string; ref: LabelRef }
  | { form: "gs1"; data: Gs1Data; text: string }
  | { form: "plain"; code: string };

const LABEL = /^wbf:1:([a-z][a-z_]*):(.+)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readScan(raw: string): ScanReading {
  const text = raw.trim();
  const label = LABEL.exec(text);
  if (label?.[1] !== undefined && label[2] !== undefined) {
    const value = label[2].trim();
    const ref: LabelRef = UUID.test(value)
      ? { by: "id", id: value.toLowerCase() }
      : { by: "code", code: value };
    return { form: "label", kind: label[1].toLowerCase(), ref };
  }
  const data = parseSupplierCode(text);
  return data === null ? { form: "plain", code: text } : { form: "gs1", data, text };
}

export type ScanTarget =
  | { status: "code"; code: string }
  | { status: "id"; id: string; kind: ScanExpect }
  | { status: "wrongKind"; found: string }
  | { status: "supplier"; text: string };

/**
 * What a screen that wants one kind of record should do with this reading. A GS1 string is only
 * a "supplier" code when the screen accepts them; otherwise its text is the code, as typed.
 */
export function targetFor(
  reading: ScanReading,
  expects: ScanExpect,
  acceptsSupplier = false,
): ScanTarget {
  if (reading.form === "plain") return { status: "code", code: reading.code };
  if (reading.form === "gs1") {
    return acceptsSupplier
      ? { status: "supplier", text: reading.text }
      : { status: "code", code: reading.text };
  }
  if (reading.kind !== expects) return { status: "wrongKind", found: reading.kind };
  return reading.ref.by === "code"
    ? { status: "code", code: reading.ref.code }
    : { status: "id", id: reading.ref.id, kind: expects };
}
