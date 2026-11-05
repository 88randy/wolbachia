import type { MessageKey } from "@wolbachia/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../app/services-context.ts";
import { OutboxWriteError } from "../../outbox/outbox-repository.ts";
import { DraftBuffer } from "./draft-buffer.ts";
import type { DraftPatch } from "./draft-buffer.ts";
import type { ShiftSnapshot } from "./service.ts";

function useShiftSnapshot(buffer: DraftBuffer, setError: (key: MessageKey | null) => void) {
  const { shiftOpen, engine } = useServices();
  const [state, setState] = useState<ShiftSnapshot | null>(null);
  const refresh = useCallback(async () => {
    const token = buffer.revision;
    const saved = await shiftOpen.read();
    if (token === buffer.revision) {
      setState(buffer.merge(saved));
      setError(null);
    }
  }, [buffer, shiftOpen, setError]);
  useEffect(() => {
    let isActive = true;
    const update = () => {
      if (isActive)
        void refresh().catch(() => {
          setError("mobile.storage.actionFailed");
        });
    };
    update();
    const unsubEngine = engine.subscribe(update);
    const unsubFeature = shiftOpen.subscribe(update);
    return () => {
      isActive = false;
      unsubEngine();
      unsubFeature();
    };
  }, [engine, refresh, setError, shiftOpen]);
  return { state, setState, refresh };
}
function useShiftActions(buffer: DraftBuffer, refresh: () => Promise<void>) {
  const { shiftOpen } = useServices();
  const [errorKey, setError] = useState<MessageKey | null>(null);
  const [isBusy, setBusy] = useState(false);
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await buffer.persist(shiftOpen);
        await action();
        await refresh();
        return true;
      } catch (error) {
        setError(
          error instanceof OutboxWriteError
            ? "mobile.storage.saveFailed"
            : "mobile.storage.actionFailed",
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [buffer, shiftOpen, refresh],
  );
  return { errorKey, isBusy, run, setError };
}
/** Persist every edit; buffer failed writes until an explicit retry or the next successful action. */
export function useM04() {
  const { shiftOpen } = useServices();
  const buffer = useRef(new DraftBuffer()).current;
  const [readError, setReadError] = useState<MessageKey | null>(null);
  const { state, setState, refresh } = useShiftSnapshot(buffer, setReadError);
  const actions = useShiftActions(buffer, refresh);
  const edit = (patch: DraftPatch) => {
    buffer.edit(patch);
    setState((current) => (current === null ? null : buffer.merge(current)));
    void buffer
      .persist(shiftOpen)
      .then(refresh)
      .catch(() => {
        actions.setError("mobile.storage.saveFailed");
      });
  };
  return {
    state,
    edit,
    refresh,
    service: shiftOpen,
    ...actions,
    errorKey: actions.errorKey ?? readError,
  };
}
export type M04Model = ReturnType<typeof useM04>;
