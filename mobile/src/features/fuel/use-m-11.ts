import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useServices } from "../../app/services-context.ts";
import type { FuelDraft, FuelState } from "./types.ts";
import { fuelEditBuffer, runFuelOperation } from "./edit-buffer.ts";
import type { FuelEditBuffer } from "./edit-buffer.ts";
import { fuelErrorKey } from "./fuel-error-key.ts";

function useFuelSubscription(input: {
  readonly refresh: () => Promise<void>;
  readonly invalidate: () => void;
  readonly setError: (key: MessageKey) => void;
}) {
  const { fuel, engine } = useServices();
  const { refresh, invalidate, setError } = input;
  useEffect(() => {
    const update = () => {
      void refresh().catch((error: unknown) => {
        setError(fuelErrorKey(error));
      });
    };
    update();
    const subscriptions = [fuel.subscribe(update), engine.subscribe(update)];
    return () => {
      invalidate();
      for (const unsubscribe of subscriptions) unsubscribe();
    };
  }, [fuel, engine, refresh, invalidate, setError]);
}

/** A late local read cannot overwrite a newer edit or a newer screen instance. */
function useFuelState(buffer: FuelEditBuffer) {
  const { fuel } = useServices();
  const [state, setState] = useState<FuelState | null>(null);
  const [errorKey, setError] = useState<MessageKey | null>(null);
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    const revision = buffer.revision;
    const saved = await fuel.read();
    if (request === sequence.current && revision === buffer.revision) setState(buffer.merge(saved));
  }, [buffer, fuel]);
  useFuelSubscription({ refresh, invalidate, setError });
  return { state, setState, errorKey, setError, refresh };
}

function useFuelActions(snapshot: ReturnType<typeof useFuelState>, buffer: FuelEditBuffer) {
  const [isBusy, setBusy] = useState(false);
  const busy = useRef(false);
  const run = async (action: () => Promise<unknown>, shouldPersist = true) => {
    if (busy.current) return;
    busy.current = true;
    setBusy(true);
    snapshot.setError(null);
    try {
      await runFuelOperation({
        buffer,
        operation: action,
        shouldPersist,
        eventId: snapshot.state?.draft?.eventId,
      });
      await snapshot.refresh();
    } catch (error) {
      snapshot.setError(fuelErrorKey(error));
    } finally {
      busy.current = false;
      setBusy(false);
    }
  };
  return { isBusy, run, busy, recover: (action: () => Promise<unknown>) => run(action, false) };
}

function useFuelEditor(input: {
  readonly snapshot: ReturnType<typeof useFuelState>;
  readonly buffer: FuelEditBuffer;
  readonly busy: { readonly current: boolean };
}) {
  const { fuel } = useServices();
  const { snapshot, buffer, busy } = input;
  return (field: "litres" | "amount" | "odometer" | "isFullRefill", value: string | boolean) => {
    const eventId = snapshot.state?.draft?.eventId;
    if (eventId === undefined || snapshot.state?.event !== null || busy.current) return;
    buffer.edit(field, {
      eventId,
      write: () => fuel.edit(field, value, eventId),
      apply: (draft: FuelDraft) => ({ ...draft, [field]: value }),
    });
    snapshot.setState((current) => (current === null ? null : buffer.merge(current)));
    void buffer
      .persist(eventId)
      .then(snapshot.refresh)
      .catch((error: unknown) => {
        snapshot.setError(fuelErrorKey(error));
      });
  };
}

/** P22 persists raw input before retake or immutable event enrollment. */
export function useM11() {
  const { fuel } = useServices();
  const buffer = fuelEditBuffer(fuel);
  const snapshot = useFuelState(buffer);
  const { busy, ...actions } = useFuelActions(snapshot, buffer);
  const edit = useFuelEditor({ snapshot, buffer, busy });
  const [submittedId, setSubmitted] = useState<string | null>(null);
  const save = () => {
    const eventId = snapshot.state?.draft?.eventId;
    if (eventId === undefined) return;
    setSubmitted(eventId);
    void actions.run(() => fuel.save(eventId));
  };
  return {
    ...snapshot,
    ...actions,
    edit,
    save,
    submittedId,
    hasPending: buffer.hasPendingFor(snapshot.state?.draft?.eventId),
    service: fuel,
  };
}
export type M11Model = ReturnType<typeof useM11>;
