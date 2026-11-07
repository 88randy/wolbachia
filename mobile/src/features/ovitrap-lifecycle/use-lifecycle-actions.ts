import type { LifecycleCompletion } from "./types.ts";
import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { actionErrorKey } from "./action-error-key.ts";
import { assertIdentity, StaleCaptureError } from "./capture-identity.ts";
import { runLifecycleAction } from "./run-action.ts";
import type { Snapshot, LifecycleService } from "./service.ts";
import type { DraftPatch } from "./types.ts";
interface Input {
  readonly state: Snapshot | null;
  readonly setState: Dispatch<SetStateAction<Snapshot | null>>;
  readonly refresh: (completion?: LifecycleCompletion) => Promise<void>;
  readonly service: LifecycleService;
  readonly setError: (key: MessageKey | null) => void;
}
function editLifecycle(input: Input, patch: DraftPatch, eventId: string): void {
  const { state, setState, refresh, service, setError } = input;
  try {
    assertIdentity(state ?? { draft: null }, eventId);
    service.draftBuffer.edit(eventId, patch);
    setState((current) => (current ? service.draftBuffer.merge(current) : current));
  } catch (error) {
    setError(actionErrorKey(error));
    return;
  }
  void service.draftBuffer
    .persist(service, eventId)
    .then(() => refresh())
    .catch((error: unknown) => {
      setError(actionErrorKey(error));
      if (error instanceof StaleCaptureError)
        void refresh().catch(() => {
          setError("mobile.ovitrap.staleView");
        });
    });
}
export function useLifecycleActions(input: Input) {
  const [isBusy, setBusy] = useState(false);
  const alive = useMounted();
  const run = async (
    action: () => Promise<Snapshot>,
    eventId: string | null,
    options: boolean | { readonly startsDraft?: boolean; readonly onSuccess?: () => void } = false,
  ) => {
    const config = typeof options === "boolean" ? { startsDraft: options } : options;
    setBusy(true);
    try {
      const result = await runLifecycleAction(
        { ...input, ...config, isCurrentView: () => alive.current },
        action,
        eventId,
      );
      return alive.current && result;
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const edit = (patch: DraftPatch, eventId: string) => {
    editLifecycle(input, patch, eventId);
  };
  return { isBusy, run, edit };
}

function useMounted() {
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}
