import { assertCaptureIdentity, StaleCaptureError } from "./capture-identity.ts";
import { actionErrorKey } from "./action-error-key.ts";
import { useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import type { OvitrapDraftBuffer } from "./draft-buffer.ts";
import type { OvitrapService } from "./service.ts";
interface Input {
  readonly service: OvitrapService;
  readonly buffer: OvitrapDraftBuffer;
  readonly refresh: () => Promise<void>;
  readonly setError: (key: MessageKey | null) => void;
}
export interface CaptureActionContext {
  readonly eventId: string | null;
  readonly startsCapture?: boolean;
}
export async function reportCaptureError(
  { refresh, setError }: Pick<Input, "refresh" | "setError">,
  error: unknown,
): Promise<void> {
  setError(actionErrorKey(error));
  if (!(error instanceof StaleCaptureError)) return;
  try {
    await refresh();
  } catch {
    // Keep the stale-view notice and its retry instruction when storage still cannot be read.
    setError("mobile.ovitrap.staleView");
    return;
  }
  setError("mobile.ovitrap.staleView");
}
/** Validate the displayed identity BEFORE flushing input or executing any command. */
export async function runCaptureAction(
  { service, buffer, refresh, setError }: Input,
  action: () => Promise<unknown>,
  context: CaptureActionContext,
): Promise<boolean> {
  setError(null);
  let isStale = false;
  try {
    const state = await service.read();
    assertCaptureIdentity(state, context.eventId);
    const abandonsDraft = context.startsCapture && state.canStartCapture && state.isShiftBlocked;
    if (!abandonsDraft) await buffer.persist(service, context.eventId);
    await action();
    await refresh();
    return true;
  } catch (error) {
    isStale = error instanceof StaleCaptureError;
    await reportCaptureError({ refresh, setError }, error);
    return false;
  } finally {
    if (buffer.takeDiscardedEditNotice() && !isStale) setError("mobile.ovitrap.immutableEdit");
  }
}
export function useCaptureActions(input: Input) {
  const [isBusy, setBusy] = useState(false);
  const run = async (
    action: () => Promise<unknown>,
    context: CaptureActionContext,
  ): Promise<boolean> => {
    setBusy(true);
    try {
      return await runCaptureAction(input, action, context);
    } finally {
      setBusy(false);
    }
  };
  return { isBusy, run };
}
