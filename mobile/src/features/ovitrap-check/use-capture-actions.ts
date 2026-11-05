import { actionErrorKey } from "./action-error-key.ts";
import { useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import type { OvitrapDraftBuffer } from "./draft-buffer.ts";
import type { OvitrapService } from "./service.ts";
interface Input {
  readonly service: OvitrapService;
  readonly buffer: OvitrapDraftBuffer;
  readonly refresh: () => Promise<void>;
  readonly setError: (key: MessageKey | null) => void;
}
/** A new capture may supersede a blocked old-shift draft; all other commands persist first. */
export async function runCaptureAction(
  { service, buffer, refresh, setError }: Input,
  action: () => Promise<unknown>,
  startsCapture = false,
): Promise<boolean> {
  setError(null);
  try {
    const state = await service.read();
    const abandonsDraft = startsCapture && state.canStartCapture && state.isShiftBlocked;
    if (!abandonsDraft) await buffer.persist(service);
    await action();
    await refresh();
    return true;
  } catch (error) {
    setError(actionErrorKey(error));
    return false;
  } finally {
    if (buffer.takeDiscardedEditNotice()) setError("mobile.ovitrap.immutableEdit");
  }
}
export function useCaptureActions(input: Input) {
  const [isBusy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>, startsCapture = false): Promise<boolean> => {
    setBusy(true);
    try {
      return await runCaptureAction(input, action, startsCapture);
    } finally {
      setBusy(false);
    }
  };
  return { isBusy, run };
}
