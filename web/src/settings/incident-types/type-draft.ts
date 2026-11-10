import type { Schemas } from "@wolbachia/api-client";
import { isConfiguredType } from "./incident-types-query";
import type { TypeTarget } from "./incident-types-query";
import { hasReadOnlyBlockers, isEditableBlocker } from "./type-blockers";
export type TypeDraft = Omit<
  Schemas["CreateIncidentTypeRequest"],
  | "supervisor_sla_seconds"
  | "coordinator_sla_seconds"
  | "report_evidence_min"
  | "close_evidence_min"
  | "severity"
> & {
  severity: Schemas["SeverityEnum"] | "";
  supervisor_sla_seconds: string;
  coordinator_sla_seconds: string;
  report_evidence_min: string;
  close_evidence_min: string;
};
export function draftOf(item?: TypeTarget): TypeDraft {
  return isConfiguredType(item) ? configuredDraft(item) : newDraft(item);
}
function newDraft(item?: TypeTarget): TypeDraft {
  return {
    code: item?.code ?? "",
    label: item?.label ?? "",
    icon: item?.icon ?? "",
    expected_revision: 0,
    severity: "",
    supervisor_id: null,
    coordinator_id: null,
    terminal_id: "",
    supervisor_sla_seconds: "",
    coordinator_sla_seconds: "",
    report_evidence_min: "",
    close_evidence_min: "",
    blocker_kinds: [],
    is_active: true,
  };
}
function configuredDraft(item: import("./incident-types-query").IncidentType): TypeDraft {
  return {
    code: item.code,
    label: item.label,
    icon: item.icon,
    expected_revision: item.revision,
    severity: item.severity,
    supervisor_id: item.supervisor,
    coordinator_id: item.coordinator,
    terminal_id: item.terminal,
    supervisor_sla_seconds: String(item.supervisor_sla_seconds),
    coordinator_sla_seconds: String(item.coordinator_sla_seconds),
    report_evidence_min: String(item.report_evidence_min),
    close_evidence_min: String(item.close_evidence_min),
    is_active: item.is_active,
    blocker_kinds: Array.isArray(item.blocker_kinds)
      ? item.blocker_kinds.filter(isEditableBlocker)
      : [],
  };
}
export function writeBody(
  draft: TypeDraft,
  item?: TypeTarget,
): Schemas["CreateIncidentTypeRequest"] | Schemas["PatchedTypeConfigurationRequest"] {
  const { code, label, icon, blocker_kinds, ...fields } = draft;
  return {
    ...fields,
    ...numericFields(draft),
    ...(!hasReadOnlyBlockers(item) ? { blocker_kinds } : {}),
    severity: requiredSeverity(draft),
    ...(!item ? { code } : {}),
    ...(!item?.is_other ? { label, icon } : {}),
  };
}
function numericFields(draft: TypeDraft) {
  return {
    supervisor_sla_seconds: Number(draft.supervisor_sla_seconds),
    coordinator_sla_seconds: Number(draft.coordinator_sla_seconds),
    report_evidence_min: Number(draft.report_evidence_min),
    close_evidence_min: Number(draft.close_evidence_min),
  };
}
export function createTypeBody(draft: TypeDraft): Schemas["CreateIncidentTypeRequest"] {
  return { ...draft, ...numericFields(draft), severity: requiredSeverity(draft) };
}
export function requiredSeverity(draft: TypeDraft): Schemas["SeverityEnum"] {
  if (draft.severity === "") throw new TypeError("An incident severity must be selected.");
  return draft.severity;
}
