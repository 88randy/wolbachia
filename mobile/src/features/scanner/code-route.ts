import type { ScannerInput } from "./domain.ts";
import type { ScannerDestination } from "./service.ts";

const MOTORCYCLE_QR = /^wbf:1:motorcycle:[^\s:]{1,50}$/;

/**
 * A motorcycle label carries the human fleet code, not a UUID. It belongs to the shift-open
 * motorcycle step, which matches the code against the downloaded fleet list.
 */
export function codeScannerRoute(input: ScannerInput): ScannerDestination | null {
  if (input.isManual || !MOTORCYCLE_QR.test(input.value.trim())) return null;
  if (input.expected) return { error: "kind" };
  return { route: { name: "openShift" } };
}
