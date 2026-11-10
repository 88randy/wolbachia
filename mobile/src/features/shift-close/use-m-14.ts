import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useServices } from "../../app/services-context.ts";
import type { ClosePatch } from "./domain.ts";
import type { CloseSnapshot } from "./service.ts";

type CloseServices = Pick<ReturnType<typeof useServices>, "shiftClose" | "engine" | "day" | "auth">;
type CloseService = CloseServices["shiftClose"];
type SetCloseState = Dispatch<SetStateAction<CloseSnapshot | null>>;
type SetFlag = (value: boolean) => void;
type CloseAction = () => Promise<unknown>;
type RunCloseAction = (action: CloseAction) => Promise<void>;

interface CloseRuntime {
  pending: ClosePatch;
  turn: number;
  isMounted: boolean;
  isActionInFlight: boolean;
  photo: AbortController | null;
}
interface RunOptions {
  readonly runtime: CloseRuntime;
  readonly flush: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly setBusy: SetFlag;
  readonly setError: SetFlag;
}
interface EditOptions {
  readonly runtime: CloseRuntime;
  readonly flush: () => Promise<void>;
  readonly setState: SetCloseState;
  readonly setError: SetFlag;
}
interface EditorOptions extends EditOptions {
  readonly service: CloseService;
  readonly run: RunCloseAction;
}
interface SubscriptionCallbacks {
  readonly refresh: () => Promise<void>;
  readonly setError: SetFlag;
}

function useCloseRuntime() {
  return useRef<CloseRuntime>({
    pending: {},
    turn: 0,
    isMounted: false,
    isActionInFlight: false,
    photo: null,
  }).current;
}

function useCloseUi() {
  const [state, setState] = useState<CloseSnapshot | null>(null);
  const [hasError, setError] = useState(false);
  const [isBusy, setBusy] = useState(false);
  return { state, setState, hasError, setError, isBusy, setBusy };
}

function setFlagWhileMounted(runtime: CloseRuntime, setFlag: SetFlag, value: boolean): void {
  if (runtime.isMounted) setFlag(value);
}

function useCloseRefresh(service: CloseService, runtime: CloseRuntime, setState: SetCloseState) {
  return useCallback(async () => {
    const request = ++runtime.turn;
    const next = await service.read();
    if (runtime.isMounted && request === runtime.turn)
      setState({
        ...next,
        draft: next.draft === null ? null : { ...next.draft, ...runtime.pending },
      });
  }, [service, runtime, setState]);
}

function useCloseFlush(service: CloseService, runtime: CloseRuntime) {
  return useCallback(async () => {
    const patch = runtime.pending;
    if (!Object.keys(patch).length) return;
    await service.update(patch);
    if (runtime.pending === patch) runtime.pending = {};
  }, [service, runtime]);
}

function useCloseRun({ runtime, flush, refresh, setBusy, setError }: RunOptions) {
  return useCallback(
    async (action: CloseAction) => {
      if (!runtime.isMounted || runtime.isActionInFlight) return;
      runtime.isActionInFlight = true;
      setBusy(true);
      setError(false);
      try {
        await flush();
        await action();
        await refresh();
      } catch {
        setFlagWhileMounted(runtime, setError, true);
      } finally {
        runtime.isActionInFlight = false;
        setFlagWhileMounted(runtime, setBusy, false);
      }
    },
    [runtime, flush, refresh, setBusy, setError],
  );
}

function reloadAfterAuthChange(
  runtime: CloseRuntime,
  auth: CloseServices["auth"],
  reload: () => void,
) {
  runtime.photo?.abort();
  runtime.turn += 1;
  if (auth.getSnapshot().phase === "unlocked") reload();
}

function stopCloseSubscriptions(runtime: CloseRuntime, stops: readonly (() => void)[]): void {
  runtime.isMounted = false;
  runtime.turn += 1;
  runtime.photo?.abort();
  for (const stop of stops) stop();
}

function subscribeClose(
  runtime: CloseRuntime,
  services: CloseServices,
  callbacks: SubscriptionCallbacks,
) {
  runtime.isMounted = true;
  const reportError = () => {
    setFlagWhileMounted(runtime, callbacks.setError, true);
  };
  const reload = () => {
    void callbacks.refresh().catch(reportError);
  };
  void services.shiftClose.start().then(reload).catch(reportError);
  const stops = [
    services.engine.subscribe(reload),
    services.day.bundle.subscribe(reload),
    services.auth.subscribe(() => {
      reloadAfterAuthChange(runtime, services.auth, reload);
    }),
  ];
  return () => {
    stopCloseSubscriptions(runtime, stops);
  };
}

function useCloseSubscription(
  runtime: CloseRuntime,
  refresh: () => Promise<void>,
  setError: SetFlag,
) {
  const { shiftClose, engine, day, auth } = useServices();
  useEffect(
    () => subscribeClose(runtime, { shiftClose, engine, day, auth }, { refresh, setError }),
    [runtime, shiftClose, engine, day, auth, refresh, setError],
  );
}

function editCloseDraft(
  patch: ClosePatch,
  { runtime, setState, flush, setError }: EditOptions,
): void {
  runtime.turn += 1;
  runtime.pending = { ...runtime.pending, ...patch };
  setState((current) =>
    current?.draft ? { ...current, draft: { ...current.draft, ...patch } } : current,
  );
  void flush()
    .then(() => {
      if (!Object.keys(runtime.pending).length) setFlagWhileMounted(runtime, setError, false);
    })
    .catch(() => {
      setFlagWhileMounted(runtime, setError, true);
    });
}

function captureCloseDraftPhoto(eventId: string, { runtime, run, service }: EditorOptions): void {
  if (runtime.isActionInFlight) return;
  runtime.photo?.abort();
  const controller = new AbortController();
  runtime.photo = controller;
  void run(() => service.capturePhoto(eventId, controller.signal));
}

function createCloseEdits(options: EditorOptions) {
  return {
    edit: (patch: ClosePatch) => {
      editCloseDraft(patch, options);
    },
    capturePhoto: (eventId: string) => {
      captureCloseDraftPhoto(eventId, options);
    },
  };
}

/** Unsaved edits survive failed writes; monotonic reads cannot replace newer input. */
export function useM14() {
  const { shiftClose: service } = useServices();
  const { state, setState, hasError, setError, isBusy, setBusy } = useCloseUi();
  const runtime = useCloseRuntime();
  const refresh = useCloseRefresh(service, runtime, setState);
  const flush = useCloseFlush(service, runtime);
  const run = useCloseRun({ runtime, flush, refresh, setBusy, setError });
  useCloseSubscription(runtime, refresh, setError);
  const { edit, capturePhoto } = createCloseEdits({
    runtime,
    flush,
    setState,
    setError,
    service,
    run,
  });
  return { state, hasError, isBusy, edit, run, service, refresh, capturePhoto };
}
export type M14Model = ReturnType<typeof useM14>;
