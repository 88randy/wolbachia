import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useServices } from "../../app/services-context.ts";
import { OvitrapDraftBuffer } from "./draft-buffer.ts";
import { useCaptureActions } from "./use-capture-actions.ts";
import type { DraftPatch } from "./types.ts";
import type { Snapshot } from "./service.ts";
function useCaptureState(buffer: OvitrapDraftBuffer, setError: (key: MessageKey | null) => void) {
  const { ovitrapCheck, engine } = useServices();
  const [state, setState] = useState<Snapshot | null>(null);
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    const revision = buffer.revision;
    const saved = await ovitrapCheck.read();
    if (request === sequence.current && revision === buffer.revision) setState(buffer.merge(saved));
  }, [buffer, ovitrapCheck]);
  useEffect(() => {
    const update = () => {
      void refresh().catch(() => {
        setError("mobile.storage.actionFailed");
      });
    };
    update();
    const unsubscribe = engine.subscribe(update);
    return () => {
      invalidate();
      unsubscribe();
    };
  }, [engine, refresh, setError, invalidate]);
  return { state, setState, refresh };
}
/** Await durable edits before actions/navigation; failed writes remain buffered and never show success. */
export function useM08() {
  const { ovitrapCheck } = useServices();
  const buffer = useRef(new OvitrapDraftBuffer()).current;
  const [errorKey, setError] = useState<MessageKey | null>(null);
  const { state, setState, refresh } = useCaptureState(buffer, setError);
  const actions = useCaptureActions({ service: ovitrapCheck, buffer, refresh, setError });
  const edit = (patch: DraftPatch) => {
    buffer.edit(patch);
    setState((current) => (current ? buffer.merge(current) : current));
    void buffer
      .persist(ovitrapCheck)
      .then(refresh)
      .catch(() => {
        setError("mobile.storage.saveFailed");
      });
  };
  return { state, errorKey, setError, edit, service: ovitrapCheck, ...actions };
}
export type M08Model = ReturnType<typeof useM08>;
