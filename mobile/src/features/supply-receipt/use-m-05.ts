import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useServices } from "../../app/services-context.ts";
import type { ReceiptDraft, ReceiptState } from "./receipt-types.ts";
import { receiptEditBuffer, runReceiptOperation } from "./edit-buffer.ts";
import type { ReceiptEditBuffer } from "./edit-buffer.ts";
import { receiptErrorKey } from "./receipt-error-key.ts";

/** Request revisions prevent an old read from replacing an input or a newer session's state. */
function useReceiptSubscription(input: {
  readonly refresh: () => Promise<void>;
  readonly invalidate: () => void;
  readonly setError: (key: MessageKey) => void;
}) {
  const { supplyReceipt, engine } = useServices();
  const { refresh, invalidate, setError } = input;
  useEffect(() => {
    const update = () => {
      void refresh().catch((error: unknown) => {
        setError(receiptErrorKey(error));
      });
    };
    update();
    const subscriptions = [supplyReceipt.subscribe(update), engine.subscribe(update)];
    return () => {
      invalidate();
      for (const unsubscribe of subscriptions) unsubscribe();
    };
  }, [supplyReceipt, engine, refresh, invalidate, setError]);
}
function useReceiptState(buffer: ReceiptEditBuffer) {
  const { supplyReceipt } = useServices();
  const [state, setState] = useState<ReceiptState | null>(null);
  const [errorKey, setError] = useState<MessageKey | null>(null);
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    const revision = buffer.revision;
    const saved = await supplyReceipt.read();
    if (request === sequence.current && revision === buffer.revision) setState(buffer.merge(saved));
  }, [buffer, supplyReceipt]);
  useReceiptSubscription({ refresh, invalidate, setError });
  return { state, setState, errorKey, setError, refresh };
}

/** Local writes finish before Save; storage failures retain the editor and never claim success. */
function useReceiptActions(
  snapshot: ReturnType<typeof useReceiptState>,
  buffer: ReceiptEditBuffer,
) {
  const [isBusy, setBusy] = useState(false);
  const busy = useRef(false);
  const run = async (action: () => Promise<unknown>, shouldPersist = true) => {
    if (busy.current) return;
    busy.current = true;
    setBusy(true);
    if (shouldPersist) snapshot.setError(null);
    try {
      await runReceiptOperation({ buffer, operation: action, shouldPersist });
      await snapshot.refresh();
    } catch (error) {
      snapshot.setError(receiptErrorKey(error));
    } finally {
      busy.current = false;
      setBusy(false);
    }
  };
  return { isBusy, run, busy, recover: (action: () => Promise<unknown>) => run(action, false) };
}
function useReceiptEditor(input: {
  readonly snapshot: ReturnType<typeof useReceiptState>;
  readonly buffer: ReceiptEditBuffer;
  readonly busy: { readonly current: boolean };
}) {
  const { snapshot, buffer, busy } = input;
  return (
    key: string,
    write: (eventId: string) => Promise<unknown>,
    apply: (draft: ReceiptDraft) => ReceiptDraft,
  ) => {
    const eventId = snapshot.state?.draft?.eventId;
    if (eventId === undefined || snapshot.state?.event !== null || busy.current) return;
    buffer.edit(key, { eventId, apply, write: () => write(eventId) });
    snapshot.setState((current) => (current === null ? null : buffer.merge(current)));
    void buffer
      .persist()
      .then(snapshot.refresh)
      .catch((error: unknown) => {
        snapshot.setError(receiptErrorKey(error));
      });
  };
}
export function useM05() {
  const { supplyReceipt } = useServices();
  const buffer = receiptEditBuffer(supplyReceipt);
  const snapshot = useReceiptState(buffer);
  const { busy, ...actions } = useReceiptActions(snapshot, buffer);
  const edit = useReceiptEditor({ snapshot, buffer, busy });
  return { ...snapshot, ...actions, edit, service: supplyReceipt };
}
export type M05Model = ReturnType<typeof useM05>;
