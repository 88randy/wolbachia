import type { Schemas } from "@wolbachia/api-client";
export const discrepancyKindKeys = {
  missing: "discrepancies.kind.missing",
  identified_extra: "discrepancies.kind.identifiedExtra",
  unidentified_extra: "discrepancies.kind.unidentifiedExtra",
} as const;
export const discrepancyOutcomeKeys = {
  ack_missing: "discrepancies.outcome.ackMissing",
  recover_dest: "discrepancies.outcome.recoverDest",
  return_origin: "discrepancies.outcome.returnOrigin",
  reference_signed_correction: "discrepancies.outcome.referenceSignedCorrection",
} as const satisfies Record<Schemas["ClosedOutcomeRequest"]["kind"], string>;

/** A short human folio: "DIF-0042" as stored, or "DIF-A1B2" for the older long codes. */
export function discrepancyFolio(code: string): string {
  const old = /^D-([0-9a-f]{32})$/i.exec(code);
  return old ? `DIF-${(old[1] ?? "").slice(0, 4).toUpperCase()}` : code;
}
