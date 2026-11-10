import { ApiError } from "@wolbachia/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionGuard } from "../../session/use-session-guard";
import type { IncidentType, TypeTarget, TypeScope } from "./incident-types-query";
import type { TypeDraft } from "./type-draft";
import { typeErrorKey } from "./type-write";
import { useTypeWriteState } from "./use-type-write-state";
import { runTypeWrite } from "./run-type-write";
/** One guarded audit write; refused input remains and a changed session never replays it. */
export function useTypeWrite(scope: TypeScope, onSaved?: (item: IncidentType) => void) {
  const begin = useSessionGuard();
  const queryClient = useQueryClient();
  const state = useTypeWriteState(scope.identity.revision);
  function save(draft: TypeDraft, item?: TypeTarget) {
    if (state.active.current !== null || !scope.identity.isSettled)
      return Promise.resolve(undefined);
    const guard = begin();
    if (guard.isStale()) return Promise.resolve(undefined);
    return runTypeWrite({
      scope,
      draft,
      item,
      guard,
      queryClient,
      state,
      token: state.start(),
      onSaved,
    });
  }
  return {
    save,
    isBusy: state.isBusy,
    needsReview: state.needsReview,
    reviewed: state.reviewed,
    error: state.error === null ? null : typeErrorKey(state.error),
    fields: state.error instanceof ApiError ? state.error.envelope?.fields : undefined,
  };
}
