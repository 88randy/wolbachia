import type { MessageKey } from "@wolbachia/i18n";
import { isAwareInstant, splitValues, UUID_PATTERN, valueOf } from "./training-input";
import type { TrainingDraft } from "./training-input";
export interface TrainingField {
  key: string;
  label: MessageKey;
  kind?: "uuid" | "uuids" | "instant" | "positive";
  isOptional?: boolean;
  hint?: MessageKey;
  isReadOnly?: boolean;
}
export const IDENTITY_FIELDS: TrainingField[] = [
  { key: "code", label: "trainings.field.code" },
  { key: "name", label: "trainings.field.name" },
];
export const VERSION_FIELDS: TrainingField[] = [
  { key: "validity_seconds", label: "trainings.field.validity", kind: "positive" },
  { key: "enabled_actions", label: "trainings.field.actions", hint: "trainings.field.actionsHint" },
  {
    key: "effective_from",
    label: "trainings.field.effective",
    kind: "instant",
    hint: "trainings.field.instantHint",
  },
];
export const CONTEXT_FIELDS: TrainingField[] = [
  { key: "center", label: "trainings.field.center", kind: "uuid" },
  { key: "quadrant", label: "trainings.field.quadrant", kind: "uuid", isOptional: true },
];
export const CERTIFICATE_FIELDS: TrainingField[] = [
  { key: "training_version", label: "trainings.field.trainingVersion", kind: "uuid" },
  {
    key: "valid_from",
    label: "trainings.field.validFrom",
    kind: "instant",
    hint: "trainings.field.instantHint",
  },
  {
    key: "valid_to",
    label: "trainings.field.validTo",
    kind: "instant",
    hint: "trainings.field.expiryHint",
  },
  {
    key: "evidence_ids",
    label: "trainings.field.evidence",
    kind: "uuids",
    hint: "trainings.field.evidenceHint",
  },
  { key: "issuer_reference", label: "trainings.field.issuer" },
  { key: "attestation", label: "trainings.field.attestation" },
];
export function isTrainingFieldValid(field: TrainingField, draft: TrainingDraft): boolean {
  const value = valueOf(draft, field.key);
  if (!value) return field.isOptional === true;
  switch (field.kind) {
    case "uuid":
      return UUID_PATTERN.test(value);
    case "uuids":
      return splitValues(value).every((id) => UUID_PATTERN.test(id));
    case "instant":
      return isAwareInstant(value);
    case "positive":
      return Number.isSafeInteger(Number(value)) && Number(value) > 0;
    default:
      return true;
  }
}
