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
export function useCaptureActions({ service, buffer, refresh, setError }: Input) {
  const [isBusy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await buffer.persist(service);
      await action();
      await refresh();
      return true;
    } catch (error) {
      setError(actionErrorKey(error));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { isBusy, run };
}
