import { useLifecycleActions } from "./use-lifecycle-actions.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useServices } from "../../app/services-context.ts";
import { observeCaptureUpdates } from "../ovitrap-check/observe-capture-updates.ts";
import type { Snapshot } from "./service.ts";
function useLifecycleState(setError: (key: MessageKey | null) => void) {
  const { ovitrapLifecycle: service, engine, shiftOpen } = useServices();
  const [state, setState] = useState<Snapshot | null>(null);
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    const revision = service.draftBuffer.revision;
    const saved = await service.read();
    if (request !== sequence.current || revision !== service.draftBuffer.revision) return;
    setState(service.draftBuffer.merge(saved));
    if (service.draftBuffer.takeDiscardedEditNotice()) setError("mobile.ovitrap.immutableEdit");
  }, [service, setError]);
  useEffect(
    () =>
      observeCaptureUpdates({
        subscriptions: [engine.subscribe, shiftOpen.subscribe],
        refresh,
        invalidate,
        setError,
      }),
    [engine, shiftOpen, refresh, invalidate, setError],
  );
  return { state, setState, refresh, service };
}
export function useM09() {
  const [errorKey, setError] = useState<MessageKey | null>(null);
  const { state, setState, refresh, service } = useLifecycleState(setError);
  const { run, edit, isBusy } = useLifecycleActions({
    state,
    setState,
    refresh,
    service,
    setError,
  });
  return { state, errorKey, isBusy, edit, run, refresh, service };
}
export type M09Model = ReturnType<typeof useM09>;
