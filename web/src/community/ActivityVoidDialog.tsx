import { useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionGuard } from "../session/use-session-guard";
import { submitVoid, useVoidLimits, VoidDialog } from "../void";
import type { VoidChoice } from "../void";
import { invalidateCommunity } from "./community-query";
import type { CommunityActivity } from "./community-query";

interface Props {
  activity: CommunityActivity;
  onClose: () => void;
}

/** Void with a reason: the original activity stays, and the reason, author and time are kept. */
export function ActivityVoidDialog({ activity, onClose }: Props) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const begin = useSessionGuard();
  const limits = useVoidLimits();
  const submit = async (choice: VoidChoice) => {
    const guard = begin();
    const result = await submitVoid(
      queryClient,
      () =>
        client.POST("/api/v1/community-activities/{id}/void/", {
          params: { path: { id: activity.id } },
          body: {
            command_id: crypto.randomUUID(),
            expected_revision: activity.revision,
            reason_code: choice.reasonCode,
            reason: choice.reason,
          },
          signal: guard.signal,
        }),
      guard.isStale,
    );
    if (result.ok) await invalidateCommunity(queryClient);
    return result;
  };
  return (
    <VoidDialog
      record={activity.code}
      limits={limits}
      submit={submit}
      onVoided={onClose}
      onCancel={onClose}
    />
  );
}
