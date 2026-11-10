import type { Schemas } from "@wolbachia/api-client";
import type { Me } from "../../session/me";

export type TrainingDraft = Readonly<Record<string, string>>;
export const UUID_PATTERN = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const AWARE_SUFFIX = /(Z|[+-]\d{2}:\d{2})$/;

/** Scope is an explicit coarse gate; the backend rechecks each whole action-granting pair. */
export function hasTrainingScope(me: Pick<Me, "scope">): boolean {
  const dimension = me.scope.centers;
  return dimension.mode === "all" || (dimension.mode === "selected" && dimension.ids.length > 0);
}
export function canPublishTraining(me: Pick<Me, "permissions" | "scope">): boolean {
  return (
    me.permissions.includes("training.manage") &&
    me.scope.centers.mode === "all" &&
    me.scope.quadrants.mode === "all"
  );
}
export function splitValues(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,\n]/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}
export function isAwareInstant(value: string): boolean {
  return AWARE_SUFFIX.test(value) && Number.isFinite(Date.parse(value));
}
export function valueOf(draft: TrainingDraft, field: string): string {
  return draft[field]?.trim() ?? "";
}
export function trainingIdentityBody(draft: TrainingDraft): Schemas["IdentityWriteRequest"] {
  return {
    command_id: crypto.randomUUID(),
    expected_revision: 0,
    code: valueOf(draft, "code"),
    name: valueOf(draft, "name"),
  };
}
export function trainingVersionBody(
  draft: TrainingDraft,
  revision: number,
): Schemas["TrainingVersionWriteRequest"] {
  return {
    command_id: crypto.randomUUID(),
    expected_revision: revision,
    validity_seconds: Number(valueOf(draft, "validity_seconds")),
    enabled_actions: splitValues(valueOf(draft, "enabled_actions")),
    effective_from: valueOf(draft, "effective_from"),
    is_active: valueOf(draft, "is_active") !== "false",
  };
}
export function certificationBody(draft: TrainingDraft): Schemas["CertificationWriteRequest"] {
  return {
    command_id: crypto.randomUUID(),
    expected_revision: 0,
    center: valueOf(draft, "center"),
    quadrant: valueOf(draft, "quadrant") || null,
    training_version: valueOf(draft, "training_version"),
    valid_from: valueOf(draft, "valid_from"),
    valid_to: valueOf(draft, "valid_to"),
    evidence_ids: splitValues(valueOf(draft, "evidence_ids")),
    issuer_reference: valueOf(draft, "issuer_reference"),
    attestation: valueOf(draft, "attestation"),
  };
}
