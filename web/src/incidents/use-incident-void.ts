import { useVoidLimits } from "../void/use-void-limits";
import { normalizeReason } from "../void/count-characters";
import { isIncidentReasonValid } from "./incident-command";
import { useIncidentDraft } from "./use-incident-draft";
import type { IncidentActionProps } from "./IncidentComment";
/** Holds the void reason and enforces the reviewed prerequisites at confirmation. */
export function useIncidentVoid(props: IncidentActionProps) {
  const limits = useVoidLimits();
  const draft = useIncidentDraft("void");
  const isDependent = props.incident.action_prerequisites?.has_void_dependents !== false;
  const isEnabled = !props.isBlocked && !isDependent && isIncidentReasonValid(draft.value, limits);
  const onConfirm = () => {
    if (isEnabled)
      void props.submit({
        action: "void",
        body: {
          expected_revision: props.incident.revision,
          reason: normalizeReason(draft.value),
        },
      });
  };
  const field = {
    draft,
    id: "incident-void-reason",
    labelKey: "incidents.workspace.voidReason" as const,
    maxLength: limits.maxLength,
  };
  return { field, isDependent, confirmation: { isEnabled, isBusy: props.isBusy, onConfirm } };
}
