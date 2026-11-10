import { useShiftDraft } from "./use-shift-draft";
import type { ShiftDecisionOptions } from "./use-shift-draft";
import { useDecisionAttempt } from "./use-decision-attempt";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { MessageKey } from "@wolbachia/i18n";
import { useApiClient } from "../api/ApiClientProvider";
import type { SessionGuard } from "../session/use-session-guard";
import { reportSessionError } from "../session/session-events";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { normalizeReason } from "../void/count-characters";

function failureKey(error: unknown): MessageKey {
  if (!(error instanceof ApiError)) return "shift.error.uncertain";
  if (error.status === 409) return "shift.error.conflict";
  if (error.status === 400) return "shift.error.invalid";
  if (error.status === 401) return "shift.error.session";
  if (error.status === 403 || error.status === 404) return "shift.error.denied";
  return "shift.error.uncertain";
}
interface Attempt {
  client: ApiClient;
  queryClient: QueryClient;
  options: ShiftDecisionOptions;
  draft: ReturnType<typeof useShiftDraft>;
  guard: SessionGuard;
}
async function sendDecision({
  client,
  queryClient,
  options,
  draft,
  guard,
}: Attempt): Promise<SessionGuard | false> {
  try {
    if (guard.isStale()) return false;
    const reply = await client.POST(
      options.kind === "approve" ? "/api/v1/shifts/{id}/approve/" : "/api/v1/shifts/{id}/observe/",
      {
        params: { path: { id: options.shift.id } },
        signal: guard.signal,
        body: { reason: normalizeReason(draft.reason), expected_revision: draft.reviewedRevision },
      },
    );
    if (guard.isStale()) return false;
    unwrap(reply);
    void invalidateOrgScoped(queryClient, "shifts");
    draft.setReason("");
    return guard;
  } catch (caught) {
    if (!guard.isStale()) {
      draft.fail(failureKey(caught));
      reportSessionError(caught, queryClient);
    }
    return false;
  }
}
/** Freeze each reviewed revision; session changes and refreshes never replay audit writes. */
export function useShiftDecision(options: ShiftDecisionOptions) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const draft = useShiftDraft(options);
  const attempt = useDecisionAttempt();
  const startReview = () => {
    draft.startReview();
    attempt.reset();
  };
  const submit = async (): Promise<SessionGuard | false> => {
    draft.setTouched(true);
    if (attempt.isRetired || draft.isInvalid || draft.isBlocked) return false;
    return attempt.run((guard) => sendDecision({ client, queryClient, options, draft, guard }));
  };
  return {
    ...draft,
    startReview,
    submit,
    isBusy: attempt.isBusy,
    isBlocked: draft.isBlocked || attempt.isRetired,
    failure: attempt.isRetired ? ("shift.error.session" as const) : draft.failure,
  };
}
export type ShiftDecisionFormState = ReturnType<typeof useShiftDecision>;
