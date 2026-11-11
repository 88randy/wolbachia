import { useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { useApiClient } from "../../api/ApiClientProvider";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import { VoidDialog, submitVoid, useVoidLimits } from "../../void";
import type { VoidChoice } from "../../void";

/**
 * "Anular entrega": nothing is deleted. The server records who, when and why, and the reserved
 * material is freed. It prepares the operation and then runs it, like every inventory command.
 */
export function CancelDeliveryDialog(props: {
  assignment: Schemas["SupplyAssignmentRead"];
  label: string;
  onClose: () => void;
}) {
  const client = useApiClient();
  const cache = useQueryClient();
  const limits = useVoidLimits();
  const { assignment } = props;
  const releaseId = assignment.lifecycle?.release_id ?? "";
  const send = async (choice: VoidChoice) => {
    const prepared = await client.POST("/api/v1/inventory-intents/", {
      body: {
        kind: "release_cancel",
        command_id: crypto.randomUUID(),
        expected_revision: assignment.revision,
        release_id: releaseId,
        reason_code: choice.reasonCode,
        reason: choice.reason,
        evidence: [],
      },
    });
    if (!prepared.response.ok || !prepared.data) return prepared;
    return client.POST("/api/v1/courier-assignments/{id}/release-cancellations/", {
      params: { path: { id: assignment.id } },
      body: { intent_id: prepared.data.intent.id },
    });
  };
  const submit = async (choice: VoidChoice) => {
    const result = await submitVoid(cache, () => send(choice));
    if (result.ok) await invalidateOrgScoped(cache, "allocation");
    return result;
  };
  return (
    <VoidDialog
      record={props.label}
      limits={limits}
      submit={submit}
      onVoided={props.onClose}
      onCancel={props.onClose}
    />
  );
}
