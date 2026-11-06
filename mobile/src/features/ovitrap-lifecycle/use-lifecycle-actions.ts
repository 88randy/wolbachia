import { useState } from "react";
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
  readonly refresh: () => Promise<void>;
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
    .then(refresh)
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
  const run = async (
    action: () => Promise<unknown>,
    eventId: string | null,
    startsDraft = false,
  ) => {
    setBusy(true);
    try {
      return await runLifecycleAction({ ...input, startsDraft }, action, eventId);
    } finally {
      setBusy(false);
    }
  };
  const edit = (patch: DraftPatch, eventId: string) => {
    editLifecycle(input, patch, eventId);
  };
  return { isBusy, run, edit };
}
