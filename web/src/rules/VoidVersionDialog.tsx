import { useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionGuard } from "../session/use-session-guard";
import { useFormatCalendarDate } from "../format/use-formatters";
import { VoidDialog, submitVoid, useVoidLimits } from "../void";
import type { VoidResult } from "../void";
import { useParameterLabels } from "./parameter-labels";
import { invalidateRuleParameters } from "./rules-query";
import type { RuleParameterVersion } from "./rules-query";

interface VoidVersionDialogProps {
  parameterKey: string;
  version: RuleParameterVersion;
  onVoided: () => void;
  onCancel: () => void;
}

/** The answers that mean the page showed an old state: another admin voided it, or it took effect. */
function isStale(result: VoidResult): boolean {
  if (result.ok) return false;
  return result.failure.kind === "alreadyVoided" || result.failure.kind === "blocked";
}

/** Sends the void of one version and, when the answer says the page was stale, refreshes it. */
function useSubmitVoid(parameterKey: string, versionId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const begin = useSessionGuard();
  return async (reason: string): Promise<VoidResult> => {
    const { signal, isStale: isOld } = begin();
    const send = () =>
      client.POST("/api/v1/rule-parameters/{parameter_key}/versions/{id}/void/", {
        params: { path: { parameter_key: parameterKey, id: versionId } },
        body: { reason },
        signal,
      });
    const result = await submitVoid(queryClient, send, isOld);
    if (!isOld() && (result.ok || isStale(result))) void invalidateRuleParameters(queryClient);
    return result;
  };
}

/**
 * The shared void dialog (#32) for one scheduled version. A version that took effect meanwhile
 * (`409 version_not_scheduled`) or was voided by someone else (`409 already_voided`) is answered
 * in the dialog and the history is refreshed behind it, so the page stops offering it.
 */
export function VoidVersionDialog(props: VoidVersionDialogProps) {
  const { parameterKey, version, onVoided, onCancel } = props;
  const labels = useParameterLabels();
  const formatCalendarDate = useFormatCalendarDate();
  return (
    <VoidDialog
      record={`${labels.name(parameterKey)} (${formatCalendarDate(version.effective_date)})`}
      limits={useVoidLimits()}
      submit={useSubmitVoid(parameterKey, version.id)}
      onVoided={onVoided}
      onCancel={onCancel}
    />
  );
}
