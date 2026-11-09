import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useServices } from "../../app/services-context.ts";
import type { IncidentState } from "./types.ts";
import { incidentEditBuffer, runIncidentOperation } from "./edit-buffer.ts";
import type { IncidentEditBuffer } from "./edit-buffer.ts";
import { incidentErrorKey } from "./incident-error-key.ts";
import type { DialOutcome } from "./domain.ts";

function useIncidentSubscription(input: {
  readonly refresh: () => Promise<void>;
  readonly invalidate: () => void;
  readonly setError: (key: MessageKey) => void;
}) {
  const { incidents, engine, auth } = useServices();
  const { refresh, invalidate, setError } = input;
  useEffect(() => {
    // Optional GPS warming never delays Begin; a failed attempt leaves the explicit no-location state.
    void incidents.prepareGps().catch(() => undefined);
    const update = () => {
      void refresh().catch((error: unknown) => {
        setError(incidentErrorKey(error));
      });
    };
    update();
    const stops = [incidents.subscribe(update), engine.subscribe(update), auth.subscribe(update)];
    return () => {
      invalidate();
      stops.forEach((stop) => {
        stop();
      });
    };
  }, [incidents, engine, auth, refresh, invalidate, setError]);
}

function useIncidentState(buffer: IncidentEditBuffer) {
  const { incidents } = useServices();
  const [state, setState] = useState<IncidentState | null>(null);
  const [errorKey, setError] = useState<MessageKey | null>(null);
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current,
      revision = buffer.revision;
    const next = await incidents.read();
    if (request === sequence.current && revision === buffer.revision) setState(buffer.merge(next));
  }, [incidents, buffer]);
  useIncidentSubscription({ refresh, invalidate, setError });
  return { state, setState, errorKey, setError, refresh };
}

function useIncidentActions(
  snapshot: ReturnType<typeof useIncidentState>,
  buffer: IncidentEditBuffer,
) {
  const [isBusy, setBusy] = useState(false);
  const busy = useRef(false);
  const run = async (operation: () => Promise<unknown>, shouldPersist = true) => {
    if (busy.current) return;
    busy.current = true;
    setBusy(true);
    snapshot.setError(null);
    try {
      await runIncidentOperation({
        buffer,
        operation,
        shouldPersist,
        eventId: snapshot.state?.draft?.eventId,
      });
      await snapshot.refresh();
    } catch (error) {
      snapshot.setError(incidentErrorKey(error));
    } finally {
      busy.current = false;
      setBusy(false);
    }
  };
  const recover = (operation: () => Promise<unknown>) => run(operation, false);
  return { isBusy, busy, run, recover };
}

function useIncidentDescription(input: {
  readonly snapshot: ReturnType<typeof useIncidentState>;
  readonly buffer: IncidentEditBuffer;
  readonly busy: { readonly current: boolean };
}) {
  const { incidents } = useServices();
  const { snapshot, buffer, busy } = input;
  return (description: string) => {
    const eventId = snapshot.state?.draft?.eventId;
    if (!eventId || snapshot.state?.event !== null || busy.current) return;
    buffer.edit("description", {
      eventId,
      write: () => incidents.edit("description", description, eventId),
      apply: (draft) => ({ ...draft, description }),
    });
    snapshot.setState((current) => (current === null ? null : buffer.merge(current)));
    void buffer
      .persist(eventId)
      .then(snapshot.refresh)
      .catch((error: unknown) => {
        snapshot.setError(incidentErrorKey(error));
      });
  };
}

/** Network refresh and the dialer never wait for local draft writes or hold the capture button. */
function useIncidentRemote(refresh: () => Promise<void>) {
  const { incidents } = useServices();
  const [isRefreshing, setRefreshing] = useState(false);
  const [readError, setReadError] = useState(false);
  const [dialOutcome, setDialOutcome] = useState<DialOutcome | null>(null);
  const refreshRemote = async () => {
    if (isRefreshing) return;
    setRefreshing(true);
    setReadError(false);
    try {
      await incidents.refresh();
      await refresh();
    } catch {
      setReadError(true);
    } finally {
      setRefreshing(false);
    }
  };
  const call = async () => {
    try {
      setDialOutcome(await incidents.call());
    } catch {
      setDialOutcome("unavailable");
    }
  };
  return { isRefreshing, readError, refreshRemote, dialOutcome, call };
}

/** Raw local edits survive failed storage and remount; only a durable outbox event means Saved. */
export function useM12() {
  const { incidents } = useServices();
  const buffer = incidentEditBuffer(incidents),
    snapshot = useIncidentState(buffer);
  const { busy, ...actions } = useIncidentActions(snapshot, buffer);
  const editDescription = useIncidentDescription({ snapshot, buffer, busy });
  const remote = useIncidentRemote(snapshot.refresh);
  const [submittedId, setSubmitted] = useState<string | null>(null);
  const save = () => {
    const id = snapshot.state?.draft?.eventId;
    if (!id) return;
    setSubmitted(id);
    void actions.run(() => incidents.save(id));
  };
  return {
    ...snapshot,
    ...actions,
    ...remote,
    editDescription,
    save,
    submittedId,
    service: incidents,
    hasPending: buffer.hasPendingFor(snapshot.state?.draft?.eventId),
  };
}
export type M12Model = ReturnType<typeof useM12>;
