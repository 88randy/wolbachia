import type { MessageKey } from "@wolbachia/i18n";
import { actionErrorKey } from "./action-error-key.ts";
import { assertIdentity, StaleCaptureError } from "./capture-identity.ts";
import type { LifecycleService } from "./service.ts";
interface Input {
  readonly service: LifecycleService;
  readonly refresh: () => Promise<void>;
  readonly setError: (key: MessageKey | null) => void;
  readonly startsDraft?: boolean;
}
async function reportError(input: Input, error: unknown): Promise<void> {
  input.setError(actionErrorKey(error));
  if (!(error instanceof StaleCaptureError)) return;
  try {
    await input.refresh();
  } catch {
    input.setError("mobile.ovitrap.staleView");
  }
}
/** Validate displayed identity BEFORE persisting buffered input, as in M-08 round 4. */
export async function runLifecycleAction(
  input: Input,
  action: () => Promise<unknown>,
  eventId: string | null,
): Promise<boolean> {
  input.setError(null);
  let isStale = false;
  try {
    const state = await input.service.read();
    assertIdentity(state, eventId);
    const abandonsDraft = input.startsDraft && state.canStartCapture && state.isShiftBlocked;
    if (!abandonsDraft) await input.service.draftBuffer.persist(input.service, eventId);
    await action();
    await input.refresh();
    return true;
  } catch (error) {
    isStale = error instanceof StaleCaptureError;
    await reportError(input, error);
    return false;
  } finally {
    if (input.service.draftBuffer.takeDiscardedEditNotice() && !isStale)
      input.setError("mobile.ovitrap.immutableEdit");
  }
}
