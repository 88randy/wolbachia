import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
const KIND_KEYS = {
  in_review: "reviews.workspace.inReview",
  rejected: "reviews.workspace.rejected",
} as const satisfies Record<Schemas["ReviewKindEnum"], MessageKey>;
const ACTION_KEYS = {
  accept: "reviews.workspace.accept",
  void: "reviews.workspace.void",
  open_incident: "reviews.workspace.openIncident",
} as const satisfies Record<Schemas["ReviewDecisionActionEnum"], MessageKey>;
const STATE_KEYS = {
  pending: "reviews.workspace.pending",
  accepted: "reviews.workspace.accepted",
  voided: "reviews.workspace.voided",
} as const satisfies Record<Schemas["ReviewDecisionStateEnum"], MessageKey>;
export function reviewKindKey(kind: Schemas["ReviewKindEnum"]): MessageKey {
  return KIND_KEYS[kind];
}
export function reviewActionKey(action: Schemas["ReviewDecisionActionEnum"]): MessageKey {
  return ACTION_KEYS[action];
}
export function reviewStateKey(state: Schemas["ReviewDecisionStateEnum"]): MessageKey {
  return STATE_KEYS[state];
}
