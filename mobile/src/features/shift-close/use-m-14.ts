import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../app/services-context.ts";
import type { ClosePatch } from "./domain.ts";
import type { CloseSnapshot } from "./service.ts";

/** Unsaved edits survive failed writes; monotonic reads cannot replace newer input. */
export function useM14() {
  const { shiftClose: service, engine, day, auth } = useServices();
  const [state, setState] = useState<CloseSnapshot | null>(null);
  const [hasError, setError] = useState(false);
  const [isBusy, setBusy] = useState(false);
  const pending = useRef<ClosePatch>({});
  const turn = useRef(0);
  const mounted = useRef(false);
  const actionInFlight = useRef(false);
  const photo = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    const request = ++turn.current;
    const next = await service.read();
    if (mounted.current && request === turn.current) setState({ ...next, draft: next.draft === null ? null : { ...next.draft, ...pending.current } });
  }, [service]);
  const flush = useCallback(async () => {
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    await service.update(patch);
    if (pending.current === patch) pending.current = {};
  }, [service]);
  const run = useCallback(async (action: () => Promise<unknown>) => {
    if (!mounted.current || actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true); setError(false);
    try { await flush(); await action(); await refresh(); }
    catch { if (mounted.current) setError(true); }
    finally { actionInFlight.current = false; if (mounted.current) setBusy(false); }
  }, [flush, refresh]);
  useEffect(() => {
    mounted.current = true;
    const reload = () => { void refresh().catch(() => { if (mounted.current) setError(true); }); };
    void service.start().then(reload).catch(() => { if (mounted.current) setError(true); });
    const stops = [engine.subscribe(reload), day.bundle.subscribe(reload), auth.subscribe(() => { photo.current?.abort(); turn.current += 1; if (auth.getSnapshot().phase === "unlocked") reload(); })];
    return () => { mounted.current = false; turn.current += 1; photo.current?.abort(); for (const stop of stops) stop(); };
  }, [service, engine, day, auth, refresh]);
  const edit = (patch: ClosePatch) => {
    turn.current += 1;
    pending.current = { ...pending.current, ...patch };
    setState((current) => current?.draft ? { ...current, draft: { ...current.draft, ...patch } } : current);
    void flush().then(() => { if (mounted.current && !Object.keys(pending.current).length) setError(false); }).catch(() => { if (mounted.current) setError(true); });
  };
  const capturePhoto = (eventId: string) => {
    if (actionInFlight.current) return;
    photo.current?.abort();
    const controller = new AbortController(); photo.current = controller;
    void run(() => service.capturePhoto(eventId, controller.signal));
  };
  return { state, hasError, isBusy, edit, run, service, refresh, capturePhoto };
}
export type M14Model = ReturnType<typeof useM14>;
