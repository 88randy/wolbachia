import type { LifecycleCompletion } from "./types.ts";
import { useLifecycleActions } from "./use-lifecycle-actions.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject, Dispatch, SetStateAction } from "react";
import type { LifecycleService } from "./service.ts";
import type { MessageKey } from "@wolbachia/i18n";
import { useServices } from "../../app/services-context.ts";
import { observeCaptureUpdates } from "../ovitrap-check/observe-capture-updates.ts";
import type { Snapshot } from "./service.ts";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
function useLifecycleState(setError: (key: MessageKey | null) => void) {
  const services = useServices();
  const { ovitrapLifecycle: service } = services;
  const [state, setState] = useState<Snapshot | null>(null);
  const sequence = useRef(0);
  const alive = useRef(false);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  const refresh = useSnapshotRefresh({ service, alive, setState, sequence, setError });
  useLifecycleObservation(
    services,
    { service, alive, setState },
    { refresh, invalidate, setError },
  );
  const { isCurrentView, reportError } = useViewFences(alive, setError);
  return { state, setState, refresh, service, isCurrentView, reportError };
}
export function useM09() {
  const [errorKey, setError] = useState<MessageKey | null>(null);
  const { state, setState, refresh, service, reportError } = useLifecycleState(setError);
  const navigation = useNavigation();
  const { run, edit, isBusy } = useLifecycleActions({
    state,
    setState,
    refresh,
    service,
    setError: reportError,
  });
  const openTask = (eventId: string) => {
    void run(() => service.openTask(eventId), eventId, {
      onSuccess: () => {
        navigation.push({ name: "day" });
      },
    });
  };
  return { state, errorKey, isBusy, edit, run, refresh, service, openTask };
}
export type M09Model = ReturnType<typeof useM09>;

interface View {
  readonly service: LifecycleService;
  readonly alive: RefObject<boolean>;
  readonly setState: Dispatch<SetStateAction<Snapshot | null>>;
}
interface Updates {
  readonly refresh: () => Promise<void>;
  readonly invalidate: () => void;
  readonly setError: (key: MessageKey | null) => void;
}
function observeLifecycle(
  services: Pick<ReturnType<typeof useServices>, "day" | "engine" | "shiftOpen">,
  view: View,
  updates: Updates,
) {
  const bundle = (listener: () => void) =>
    services.day.bundle.subscribe(() => {
      if (!view.alive.current) return;
      updates.invalidate();
      view.service.cancelInteraction();
      view.setState(null);
      listener();
    });
  return observeCaptureUpdates({
    ...updates,
    subscriptions: [services.engine.subscribe, services.shiftOpen.subscribe, bundle],
    setError: (key) => {
      if (view.alive.current) updates.setError(key);
    },
  });
}

function useLifecycleObservation(
  services: Pick<ReturnType<typeof useServices>, "day" | "engine" | "shiftOpen">,
  view: View,
  updates: Updates,
) {
  const { service, alive, setState } = view;
  const { refresh, invalidate, setError } = updates;
  useEffect(() => {
    alive.current = true;
    const stop = observeLifecycle(
      services,
      { service, alive, setState },
      { refresh, invalidate, setError },
    );
    return () => {
      alive.current = false;
      service.cancelInteraction();
      stop();
    };
  }, [services, service, alive, setState, refresh, invalidate, setError]);
}
function useViewFences(alive: RefObject<boolean>, setError: (key: MessageKey | null) => void) {
  const isCurrentView = useCallback(() => alive.current, [alive]);
  const reportError = useCallback(
    (key: MessageKey | null) => {
      if (alive.current) setError(key);
    },
    [alive, setError],
  );
  return { isCurrentView, reportError };
}

interface SnapshotPublication extends View {
  readonly sequence: RefObject<number>;
  readonly setError: (key: MessageKey | null) => void;
}
function useSnapshotRefresh(input: SnapshotPublication) {
  const { service, alive, setState, sequence, setError } = input;
  return useCallback(
    async (completion?: LifecycleCompletion) => {
      const request = ++sequence.current;
      const revision = service.draftBuffer.revision;
      const saved = await service.read();
      const current = () =>
        alive.current && request === sequence.current && revision === service.draftBuffer.revision;
      const publish = () => {
        setState(service.draftBuffer.merge(saved));
        completion?.normalize(revision, saved.draft?.eventId ?? null);
        if (service.draftBuffer.takeDiscardedEditNotice()) setError("mobile.ovitrap.immutableEdit");
      };
      if (completion) await completion.complete(current, publish);
      else if (current()) publish();
    },
    [service, setError, setState, sequence, alive],
  );
}
