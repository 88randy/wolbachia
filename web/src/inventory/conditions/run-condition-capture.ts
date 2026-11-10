import { unwrap } from "@wolbachia/api-client";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { useInventoryContext } from "../use-inventory-context";
import { invalidateInventory } from "../inventory-query";
import { reportSessionError } from "../../session/session-events";
import { EMPTY_CAPTURE, INITIAL_CAPTURE, captureFailure } from "./condition-capture-state";
import type { CaptureState, CaptureValues } from "./condition-capture-state";
import { isConditionAccessDenied } from "./condition-access";
interface Request {
  scope: ReturnType<typeof useInventoryContext>;
  queryClient: QueryClient;
  lot: string;
  values: CaptureValues;
  token: symbol;
  attempt: RefObject<symbol | null>;
  setState: Dispatch<SetStateAction<CaptureState>>;
  setValues: Dispatch<SetStateAction<CaptureValues>>;
}
/** Only the current attempt may publish. Session changes retire it before another attempt starts. */
export async function runConditionCapture(request: Request) {
  const { scope, token, attempt, queryClient, setState, setValues } = request;
  const guard = scope.beginWrite();
  const isCurrent = () => attempt.current === token && !guard.isStale() && scope.isCurrentRead();
  try {
    await postConditionReading(request, guard.signal);
    if (!isCurrent()) return;
    setState({ ...INITIAL_CAPTURE, message: "conditions.state.saved" });
    setValues({ ...EMPTY_CAPTURE });
    await invalidateInventory(queryClient);
  } catch (error) {
    if (!isCurrent()) return;
    setState(captureFailure(error));
    reportSessionError(error, queryClient);
    if (isConditionAccessDenied(error)) await invalidateInventory(queryClient);
  } finally {
    if (attempt.current === token) attempt.current = null;
  }
}
async function postConditionReading({ scope, lot, values }: Request, signal: AbortSignal) {
  const body = {
    ...values,
    ...(scope.readContext.mode === "custody" ? { location_id: scope.readContext.location } : {}),
  };
  return unwrap(
    await scope.client.POST("/api/v1/lots/{id}/conditions/", {
      params: { path: { id: lot } },
      body,
      signal,
    }),
  );
}
