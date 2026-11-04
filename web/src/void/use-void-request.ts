import { useEffect, useRef, useState } from "react";
import type { VoidResult } from "./submit-void";
import type { VoidFailure } from "./void-failure";

export type VoidStatus =
  | { kind: "editing" }
  /** The reason is shorter than the minimum (checked by the form, or refused by the server). */
  | { kind: "tooShort" }
  | { kind: "busy" }
  | { kind: "failed"; failure: VoidFailure };

export interface VoidRequest {
  status: VoidStatus;
  /** The minimum the server asked for when it refused a reason; `undefined` until then. */
  serverMin: number | undefined;
  markTooShort: () => void;
  markFailed: (failure: VoidFailure) => void;
  send: (reason: string) => Promise<void>;
}

function useIsMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

function statusAfter(result: VoidResult): VoidStatus {
  if (result.ok) return { kind: "editing" };
  if (result.failure.kind === "reasonTooShort") return { kind: "tooShort" };
  return { kind: "failed", failure: result.failure };
}

/** The request of the void dialog and what its answer means for the form. */
export function useVoidRequest(
  submit: (reason: string) => Promise<VoidResult>,
  onVoided: () => void,
): VoidRequest {
  const [status, setStatus] = useState<VoidStatus>({ kind: "editing" });
  const [serverMin, setServerMin] = useState<number>();
  const mounted = useIsMounted();

  async function send(reason: string) {
    setStatus({ kind: "busy" });
    const result = await submit(reason);
    if (!mounted.current) return;
    setStatus(statusAfter(result));
    if (!result.ok && result.failure.kind === "reasonTooShort") {
      setServerMin(result.failure.minLength);
    }
    if (result.ok) onVoided();
  }

  return {
    status,
    serverMin,
    markTooShort: () => {
      setStatus({ kind: "tooShort" });
    },
    markFailed: (failure) => {
      setStatus({ kind: "failed", failure });
    },
    send,
  };
}
