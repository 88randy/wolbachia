import { useState } from "react";
import { useVoidLimits } from "../void/use-void-limits";
import { normalizeReason } from "../void/count-characters";
import { useIncidentDraft } from "./use-incident-draft";
import { canCloseIncident, verifiedIncidentEvidence } from "./incident-command";
import type { IncidentActionProps } from "./IncidentComment";
import type { Incident, IncidentScope } from "./incidents-query";

function closeEvidenceMinimum(incident: Incident) {
  return (
    incident.action_prerequisites?.close_evidence_min ?? incident.type_snapshot?.close_evidence_min
  );
}

function submitClose(
  props: IncidentActionProps,
  capture: { isEnabled: boolean; reason: string; ids: string[] },
) {
  if (capture.isEnabled)
    void props.submit({
      action: "close",
      body: {
        expected_revision: props.incident.revision,
        reason: normalizeReason(capture.reason),
        evidence_ids: capture.ids,
      },
    });
}
/** Owns the close capture and preserves the reviewed revision until confirmation. */
export function useIncidentClose(props: IncidentActionProps & { scope: IncidentScope }) {
  const limits = useVoidLimits();
  const draft = useIncidentDraft("close");
  const [uploaded, setUploaded] = useState<string[]>([]);
  const ids = verifiedIncidentEvidence(props.incident, uploaded);
  const isEnabled =
    !props.isBlocked && canCloseIncident(props.incident, ids, { reason: draft.value, limits });
  const field = {
    draft,
    id: "incident-close-reason",
    labelKey: "incidents.workspace.closeReason" as const,
    maxLength: limits.maxLength,
  };
  const onVerified = (id: string) => {
    setUploaded((previous) => [...new Set([...previous, id])]);
  };
  const evidence = {
    scope: props.scope,
    incident: props.incident,
    isBlocked: props.isBlocked,
    onVerified,
  };
  const onConfirm = () => {
    submitClose(props, { isEnabled, reason: draft.value, ids });
  };
  const confirmation = { isEnabled, isBusy: props.isBusy, onConfirm };
  const requiredEvidence = closeEvidenceMinimum(props.incident);
  return { field, evidence, confirmation, requiredEvidence };
}
