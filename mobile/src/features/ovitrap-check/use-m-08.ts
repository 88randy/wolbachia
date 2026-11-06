import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useServices } from "../../app/services-context.ts";
import type { OvitrapDraftBuffer } from "./draft-buffer.ts";
import { observeCaptureUpdates } from "./observe-capture-updates.ts";
import { assertCaptureIdentity } from "./capture-identity.ts";
import { reportCaptureError, useCaptureActions } from "./use-capture-actions.ts";
import type { DraftPatch } from "./types.ts";
import type { Snapshot } from "./service.ts";
function useCaptureUpdates(
  refresh: () => Promise<void>,
  invalidate: () => void,
  setError: (key: MessageKey | null) => void,
) {
  const { engine, shiftOpen } = useServices();
  useEffect(
    () =>
      observeCaptureUpdates({
        subscriptions: [engine.subscribe, shiftOpen.subscribe],
        refresh,
        invalidate,
        setError,
      }),
    [engine, shiftOpen, refresh, setError, invalidate],
  );
}
function useCaptureState(buffer: OvitrapDraftBuffer, setError: (key: MessageKey | null) => void) {
  const { ovitrapCheck } = useServices();
  const [state, setState] = useState<Snapshot | null>(null);
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    const revision = buffer.revision;
    const saved = await ovitrapCheck.read();
    if (request !== sequence.current || revision !== buffer.revision) return;
    setState(buffer.merge(saved));
    if (buffer.takeDiscardedEditNotice()) setError("mobile.ovitrap.immutableEdit");
  }, [buffer, ovitrapCheck, setError]);
  useCaptureUpdates(refresh, invalidate, setError);
  return { state, setState, refresh };
}
/** Await durable edits before actions/navigation; failed writes remain buffered and never show success. */
export function useM08() {
  const { ovitrapCheck } = useServices();
  const buffer = ovitrapCheck.draftBuffer;
  const [errorKey, setError] = useState<MessageKey | null>(null);
  const { state, setState, refresh } = useCaptureState(buffer, setError);
  const input = { service: ovitrapCheck, buffer, refresh, setError };
  const actions = useCaptureActions(input);
  const edit = (patch: DraftPatch, eventId: string) => {
    try {
      assertCaptureIdentity(state ?? { draft: null, event: null }, eventId);
    } catch (error) {
      void reportCaptureError(input, error);
      return;
    }
    buffer.edit(eventId, patch);
    setState((current) => (current ? buffer.merge(current) : current));
    void buffer
      .persist(ovitrapCheck)
      .then(refresh)
      .catch((error: unknown) => {
        return reportCaptureError(input, error);
      });
  };
  return { state, errorKey, setError, edit, service: ovitrapCheck, ...actions };
}
export type M08Model = ReturnType<typeof useM08>;
