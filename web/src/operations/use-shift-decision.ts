import { useDecisionAttempt } from "./use-decision-attempt";
import { currentShiftReadSequence } from "./shifts-query";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { MessageKey } from "@wolbachia/i18n";
import { useApiClient } from "../api/ApiClientProvider";
import type { SessionGuard } from "../session/use-session-guard";
import { reportSessionError } from "../session/session-events";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { useVoidLimits } from "../void/use-void-limits";
import { normalizeReason } from "../void/count-characters";
import { canDecide, reasonError } from "./shift-validation";
import type { DecisionKind, ShiftDetail } from "./shift-validation";

function failureKey(error: unknown): MessageKey {
  if (!(error instanceof ApiError)) return "shift.error.uncertain";
  if (error.status === 409) return "shift.error.conflict";
  if (error.status === 400) return "shift.error.invalid";
  if (error.status === 401) return "shift.error.session";
  if (error.status === 403 || error.status === 404) return "shift.error.denied";
  return "shift.error.uncertain";
}
interface Options { shift: ShiftDetail; kind: DecisionKind; isReady: boolean; readSequence: number }
function useDecisionDraft(options: Options) {
  const limits = useVoidLimits();
  const [blockedRead, setBlockedRead] = useState(-1);
  const [reason, setReason] = useState("");
  const [failure, setFailure] = useState<MessageKey>();
  const [isTouched, setTouched] = useState(false);
  const [reviewedRevision, setRevision] = useState(options.shift.validation.revision);
  const error = reasonError(reason, limits);
  const isBlocked = options.readSequence <= blockedRead || !options.isReady || !canDecide(options.shift, options.kind) ||
    reviewedRevision !== options.shift.validation.revision || (failure !== undefined && failure !== "shift.error.invalid");
  const startReview = () => {
    if (!options.isReady || options.readSequence <= blockedRead) return;
    setRevision(options.shift.validation.revision);
    setFailure(undefined);
  };
  const fail = (key: MessageKey) => {
    setFailure(key);
    if (key !== "shift.error.invalid") setBlockedRead(currentShiftReadSequence());
  };
  return { reason, setReason, failure, fail, setTouched, limits, isBlocked,
    error: isTouched ? error : undefined, isInvalid: error !== undefined,
    reviewedRevision, startReview, onBlur: () => { setTouched(true); } };
}
interface Attempt {
  client: ApiClient;
  queryClient: QueryClient;
  options: Options;
  draft: ReturnType<typeof useDecisionDraft>;
  guard: SessionGuard;
}
async function sendDecision({ client, queryClient, options, draft, guard }: Attempt): Promise<SessionGuard | false> {
  try {
    if (guard.isStale()) return false;
    const reply = await client.POST(options.kind === "approve" ? "/api/v1/shifts/{id}/approve/" : "/api/v1/shifts/{id}/observe/", {
      params: { path: { id: options.shift.id } }, signal: guard.signal,
      body: { reason: normalizeReason(draft.reason), expected_revision: draft.reviewedRevision },
    });
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
export function useShiftDecision(options: Options) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const draft = useDecisionDraft(options);
  const attempt = useDecisionAttempt();
  const startReview = () => { draft.startReview(); attempt.reset(); };
  const submit = async (): Promise<SessionGuard | false> => {
    draft.setTouched(true);
    if (attempt.isRetired || draft.isInvalid || draft.isBlocked) return false;
    return attempt.run((guard) => sendDecision({ client, queryClient, options, draft, guard }));
  };
  return { ...draft, startReview, submit, isBusy: attempt.isBusy,
    isBlocked: draft.isBlocked || attempt.isRetired,
    failure: attempt.isRetired ? "shift.error.session" as const : draft.failure };
}
export type ShiftDecisionFormState = ReturnType<typeof useShiftDecision>;
