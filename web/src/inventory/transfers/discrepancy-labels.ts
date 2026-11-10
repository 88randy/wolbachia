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
