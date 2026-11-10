import { useQueryClient } from "@tanstack/react-query";
import { useSessionGuard } from "../session/use-session-guard";
import type { ReceptionCommand } from "./reception-command";
import type { ReceptionScope } from "./reception-query";
import { requiresReceptionReview } from "./reception-result";
import { executeReception, reviewReception } from "./reception-attempt";
import { useReceptionCommandState } from "./use-reception-command-state";

/** A synchronous gate owns writes; revision changes retire attempts without replay. */
export function useReceptionCommand(scope: ReceptionScope) {
  const cache = useQueryClient();
  const begin = useSessionGuard();
  const { token, isBusy, setBusy, result, setResult } = useReceptionCommandState(
    scope.identity.revision,
  );
  const isReviewRequired = result !== null && requiresReceptionReview(result);
  const context = { scope, cache, begin, token, publish: setResult, setBusy };
  const submit = (command: ReceptionCommand, onStarted?: () => void) =>
    isReviewRequired ? Promise.resolve(false) : executeReception(context, command, onStarted);
  return {
    canSubmit: scope.identity.isSettled,
    revision: scope.identity.revision,
    isBusy,
    result,
    isReviewRequired,
    submit,
    setResult,
    review: () => reviewReception(context),
  };
}
export type ReceptionActions = ReturnType<typeof useReceptionCommand>;
