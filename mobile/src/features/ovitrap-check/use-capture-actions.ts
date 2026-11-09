import {
  assertCaptureIdentity,
  StaleCaptureError,
  ConcurrentCaptureError,
} from "./capture-identity.ts";
import { actionErrorKey } from "./action-error-key.ts";
import { useEffect, useRef, useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import type { OvitrapDraftBuffer } from "./draft-buffer.ts";
import type { OvitrapService } from "./service.ts";
import { requireCaptureSignal } from "../../attachments/capture-signal.ts";
interface Input {
  readonly service: OvitrapService;
  readonly buffer: OvitrapDraftBuffer;
  readonly refresh: (signal?: AbortSignal) => Promise<void>;
  readonly setError: (key: MessageKey | null) => void;
}
export interface CaptureActionContext {
  readonly eventId: string | null;
  readonly startsCapture?: boolean;
  readonly signal?: AbortSignal;
}
function requireActive(context: CaptureActionContext): void {
  if (context.signal) requireCaptureSignal(context.signal);
}
function reportDiscard(input: Input, context: CaptureActionContext, isStale: boolean): void {
  if (context.signal?.aborted || isStale) return;
  if (input.buffer.takeDiscardedEditNotice()) input.setError("mobile.ovitrap.immutableEdit");
}
function activeReporter(input: Input, context: CaptureActionContext) {
  return {
    refresh: () => (context.signal?.aborted ? Promise.resolve() : input.refresh(context.signal)),
    setError: (key: MessageKey | null) => {
      if (!context.signal?.aborted) input.setError(key);
    },
  };
}
async function performAction(
  input: Input,
  action: () => Promise<unknown>,
  context: CaptureActionContext,
) {
  const { service, buffer, refresh } = input;
  const state = await service.read();
  requireActive(context);
  assertCaptureIdentity(state, context.eventId);
  const abandonsDraft = context.startsCapture && state.canStartCapture && state.isShiftBlocked;
  if (!abandonsDraft) await buffer.persist(service, context.eventId);
  requireActive(context);
  await action();
  requireActive(context);
  await refresh(context.signal);
  requireActive(context);
}
export async function reportCaptureError(
  { refresh, setError }: Pick<Input, "refresh" | "setError">,
  error: unknown,
): Promise<void> {
  const key = actionErrorKey(error);
  setError(key);
  if (key !== "mobile.ovitrap.staleView" && !(error instanceof ConcurrentCaptureError)) return;
  try {
    await refresh();
  } catch {
    // Keep the stale-view notice and its retry instruction when storage still cannot be read.
    setError(key);
    return;
  }
  setError(key);
}
/** Validate the displayed identity BEFORE flushing input or executing any command. */
export async function runCaptureAction(
  { service, buffer, refresh, setError }: Input,
  action: () => Promise<unknown>,
  context: CaptureActionContext,
): Promise<boolean> {
  if (context.signal?.aborted) return false;
  setError(null);
  let isStale = false;
  try {
    await performAction({ service, buffer, refresh, setError }, action, context);
    return true;
  } catch (error) {
    if (context.signal?.aborted) return false;
    isStale = error instanceof StaleCaptureError;
    await reportCaptureError(
      activeReporter({ service, buffer, refresh, setError }, context),
      error,
    );
    return false;
  } finally {
    reportDiscard({ service, buffer, refresh, setError }, context, isStale);
  }
}
export function useCaptureActions(input: Input) {
  const [isBusy, setBusy] = useState(false);
  const mounted = useMounted();
  const run = async (
    action: () => Promise<unknown>,
    context: CaptureActionContext,
  ): Promise<boolean> => {
    setBusy(true);
    try {
      return await runCaptureAction(input, action, context);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return { isBusy, run };
}
function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
