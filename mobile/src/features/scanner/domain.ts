import { parseQr } from "../ovitrap-check/domain.ts";
import type { QrKind } from "../ovitrap-check/types.ts";
import type { ScannerResource } from "./resource-source.ts";

const HUMAN_CODE_MAX_LENGTH = 50;

export type ScannerError =
  "invalid" | "version" | "kind" | "unavailable" | "retired" | "duplicate" | "storage";
export type ScannerResult =
  | { readonly resource: ScannerResource; readonly manualCapture: boolean }
  | { readonly error: ScannerError };
export interface ScannerInput {
  readonly value: string;
  readonly isManual: boolean;
  readonly expected?: QrKind;
}

/** A QR identity is never authority. Only an unambiguous current local projection may route. */
export function resolveScanner(
  input: ScannerInput,
  resources: readonly ScannerResource[],
): ScannerResult {
  if (input.isManual) return resolveManual(input, resources);
  const parsed = parseQr(input.value);
  if (!parsed) return { error: invalidQrReason(input.value) };
  if (input.expected && input.expected !== parsed.kind) return { error: "kind" };
  return chooseResource(
    resources.filter(
      (resource) => resource.kind === parsed.kind && resource.id.toLowerCase() === parsed.id,
    ),
    false,
  );
}
function resolveManual(input: ScannerInput, resources: readonly ScannerResource[]): ScannerResult {
  const code = input.value.trim();
  if (!code || Array.from(code).length > HUMAN_CODE_MAX_LENGTH || /[\p{Cc}\p{Cs}]/u.test(code))
    return { error: "invalid" };
  return chooseResource(
    resources.filter(
      (resource) => resource.code === code && (!input.expected || resource.kind === input.expected),
    ),
    true,
  );
}
function chooseResource(
  matches: readonly ScannerResource[],
  manualCapture: boolean,
): ScannerResult {
  const resource = matches.length === 1 ? matches[0] : undefined;
  if (!resource) return { error: "unavailable" };
  return resource.isRetired ? { error: "retired" } : { resource, manualCapture };
}
function invalidQrReason(value: string): ScannerError {
  const parts = /^wbf:([^:]+):([^:]+):([^:]+)$/.exec(value);
  if (!parts || /[^\x20-\x7e]/.test(value)) return "invalid";
  if (parts[1] !== "1") return "version";
  return ["lot", "ovitrap", "bag", "release-device", "sample"].includes(parts[2] ?? "")
    ? "invalid"
    : "kind";
}
