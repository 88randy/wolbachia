import type { LifecycleCompletion } from "./types.ts";
import type { MessageKey } from "@wolbachia/i18n";
import { actionErrorKey } from "./action-error-key.ts";
import { assertIdentity, StaleCaptureError } from "./capture-identity.ts";
import { LifecycleReadDenied } from "./service.ts";
import type { LifecycleService, Snapshot } from "./service.ts";
interface Input {
  readonly service: LifecycleService;
  readonly refresh: (completion?: LifecycleCompletion) => Promise<void>;
  readonly onSuccess?: () => void;
  readonly setError: (key: MessageKey | null) => void;
  readonly startsDraft?: boolean;
  readonly isCurrentView?: () => boolean;
}
async function reportError(input: Input, error: unknown): Promise<void> {
  if (error instanceof LifecycleReadDenied) return reportDenied(input, error);
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
  action: () => Promise<Snapshot>,
  eventId: string | null,
): Promise<boolean> {
  input.setError(null);
  let isStale = false;
  try {
    await prepareAction(input, eventId);
    const result = await action();
    if (input.isCurrentView?.() === false || !result.completion) return false;
    await input.refresh(result.completion);
    return await result.completion.complete(input.isCurrentView ?? (() => true), input.onSuccess);
  } catch (error) {
    isStale = error instanceof StaleCaptureError;
    if (input.isCurrentView?.() !== false) await reportError(input, error);
    return false;
  } finally {
    reportDiscarded(input, isStale);
  }
}

async function prepareAction(input: Input, eventId: string | null): Promise<void> {
  const state = await input.service.read();
  if (input.isCurrentView?.() === false) throw new StaleCaptureError();
  assertIdentity(state, eventId);
  const abandonsDraft = input.startsDraft && state.canStartCapture && state.isShiftBlocked;
  if (!abandonsDraft) await input.service.draftBuffer.persist(input.service, eventId);
}
function reportDiscarded(input: Input, isStale: boolean): void {
  if (
    input.isCurrentView?.() !== false &&
    input.service.draftBuffer.takeDiscardedEditNotice() &&
    !isStale
  )
    input.setError("mobile.ovitrap.immutableEdit");
}

async function reportDenied(input: Input, error: LifecycleReadDenied): Promise<void> {
  const current = input.isCurrentView ?? (() => true);
  if (!(await error.completion.complete(current))) return;
  try {
    await input.refresh(error.completion);
  } catch {
    // The original denial still supplies the inline error, only while its turn remains current.
  }
  await error.completion.complete(current, () => {
    input.setError(actionErrorKey(error));
  });
}
