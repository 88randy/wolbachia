import type { MessageKey } from "@wolbachia/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../app/services-context.ts";
import { OutboxWriteError } from "../../outbox/outbox-repository.ts";
import { DraftBuffer } from "./draft-buffer.ts";
import type { DraftPatch } from "./draft-buffer.ts";
import type { ShiftOpenService, ShiftSnapshot } from "./service.ts";

/** A monotonic request sequence prevents stale reads from publishing after refresh or unmount. */
export class ShiftSnapshotReader {
  readonly #buffer: DraftBuffer;
  #requestSequence = 0;
  constructor(buffer: DraftBuffer) {
    this.#buffer = buffer;
  }
  invalidate(): void {
    this.#requestSequence += 1;
  }
  async refresh(
    service: Pick<ShiftOpenService, "read">,
    publish: (snapshot: ShiftSnapshot) => void,
  ): Promise<void> {
    const request = ++this.#requestSequence;
    const token = this.#buffer.revision;
    try {
      const saved = await service.read();
      if (request === this.#requestSequence && token === this.#buffer.revision)
        publish(this.#buffer.merge(saved));
    } catch (error) {
      if (request === this.#requestSequence && token === this.#buffer.revision) throw error;
    }
  }
}

function useShiftSubscription(
  reader: ShiftSnapshotReader,
  refresh: () => Promise<void>,
  setError: (key: MessageKey | null) => void,
) {
  const { shiftOpen, engine } = useServices();
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
      reader.invalidate();
      unsubEngine();
      unsubFeature();
    };
  }, [engine, reader, refresh, setError, shiftOpen]);
}
function useShiftSnapshot(buffer: DraftBuffer, setError: (key: MessageKey | null) => void) {
  const { shiftOpen } = useServices();
  const [state, setState] = useState<ShiftSnapshot | null>(null);
  const reader = useRef(new ShiftSnapshotReader(buffer)).current;
  const refresh = useCallback(
    () =>
      reader.refresh(shiftOpen, (saved) => {
        setState(saved);
        setError(null);
      }),
    [reader, shiftOpen, setError],
  );
  useShiftSubscription(reader, refresh, setError);
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
