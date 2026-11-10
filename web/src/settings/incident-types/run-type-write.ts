import type { QueryClient } from "@tanstack/react-query";
import type { SessionGuard } from "../../session/use-session-guard";
import { reportSessionError } from "../../session/session-events";
import { invalidateTypes } from "./incident-types-query";
import type { IncidentType, TypeTarget, TypeScope } from "./incident-types-query";
import type { TypeDraft } from "./type-draft";
import type { TypeWriteState } from "./use-type-write-state";
import { saveType } from "./type-write";
interface Request {
  scope: TypeScope;
  draft: TypeDraft;
  item?: TypeTarget;
  guard: SessionGuard;
  queryClient: QueryClient;
  state: TypeWriteState;
  token: number;
  onSaved?: (item: IncidentType) => void;
}
/** Current attempt and session jointly own every publication and finalizer. */
export async function runTypeWrite(request: Request) {
  const { state, guard, token, queryClient } = request;
  const isCurrent = () => !guard.isStale() && state.isCurrent(token);
  try {
    const result = await saveType(request);
    if (!isCurrent()) return undefined;
    request.onSaved?.(result);
    await invalidateTypes(queryClient);
    return isCurrent() ? result : undefined;
  } catch (failure) {
    if (isCurrent()) {
      state.rejected(failure);
      reportSessionError(failure, queryClient);
    }
    return undefined;
  } finally {
    state.finish(token);
  }
}
