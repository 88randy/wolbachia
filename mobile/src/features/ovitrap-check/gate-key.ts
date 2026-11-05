import type { MessageKey } from "@wolbachia/i18n";
import type { Gate } from "./validation.ts";
export const GATE_KEYS: Readonly<Record<Gate, MessageKey>> = {
  weekContext: "mobile.ovitrap.staleWeekContext",
  shift: "mobile.ovitrap.gateShift",
  assignment: "mobile.ovitrap.gateAssignment",
  catalog: "mobile.ovitrap.gateCatalog",
  rules: "mobile.ovitrap.gateRules",
  point: "mobile.ovitrap.gatePoint",
  finding: "mobile.ovitrap.gateFinding",
  paddle: "mobile.ovitrap.gatePaddle",
  eggs: "mobile.ovitrap.gateEggs",
  bag: "mobile.ovitrap.gateBag",
  conditions: "mobile.ovitrap.gateConditions",
  other: "mobile.ovitrap.gateOther",
  prepare: "mobile.ovitrap.gatePrepare",
  evidence: "mobile.ovitrap.gateEvidence",
  reuse: "mobile.ovitrap.gateReuse",
  reason: "mobile.ovitrap.gateReason",
  review: "mobile.ovitrap.gateReview",
};
