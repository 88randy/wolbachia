import { useRef } from "react";
import type { SyntheticEvent } from "react";
import { useVoidLimits } from "../void";
import { hasForbiddenCharacters } from "../void/count-characters";
import { useVoidRequest } from "../void/use-void-request";
import { useVoidText } from "../void/use-void-text";
import { useMotorcycleAction } from "./use-motorcycle-action";

/** Free-text evidence shares the server's reason rules, without loading a void catalog. */
export function useUnblockForm(id: string, onDone: () => void) {
  const limits = useVoidLimits();
  const send = useMotorcycleAction(id, "unblock");
  const request = useVoidRequest(send, onDone, () => undefined);
  const text = useVoidText(limits, request);
  const busy = useRef(false);
  const canSubmit =
    text.count >= text.minLength && Array.from(text.normalized).length <= text.maxLength;
  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (busy.current || !canSubmit) return;
    if (hasForbiddenCharacters(text.normalized)) {
      request.markFailed({ kind: "invalidCharacters" });
      return;
    }
    busy.current = true;
    void request.send({ reasonCode: "", reason: text.normalized }).finally(() => {
      busy.current = false;
    });
  };
  return { ...text, canSubmit, isBusy: request.status.kind === "busy", handleSubmit };
}

export type UnblockForm = ReturnType<typeof useUnblockForm>;
