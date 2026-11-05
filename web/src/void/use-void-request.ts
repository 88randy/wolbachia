import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { VoidChoice } from "./use-void-form";
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
  reset: () => void;
  send: (choice: VoidChoice) => Promise<void>;
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
  if (result.ok || "isStale" in result) return { kind: "editing" };
  if (result.failure.kind === "reasonTooShort") return { kind: "tooShort" };
  return { kind: "failed", failure: result.failure };
}

/** The request of the void dialog and what its answer means for the form. */
export function useVoidRequest(
  submit: (choice: VoidChoice) => Promise<VoidResult>,
  onVoided: () => void,
  onCodeUnknown: () => void,
): VoidRequest {
  const [status, setStatus] = useState<VoidStatus>({ kind: "editing" });
  const [serverMin, setServerMin] = useState<number>();
  const mounted = useIsMounted();

  async function send(choice: VoidChoice) {
    setStatus({ kind: "busy" });
    const result = await submit(choice);
    if (!mounted.current) return;
    setStatus(statusAfter(result));
    if (!result.ok && !("isStale" in result)) {
      if (result.failure.kind === "reasonTooShort") setServerMin(result.failure.minLength);
      if (result.failure.kind === "codeUnknown") onCodeUnknown();
    }
    if (result.ok) onVoided();
  }

  return { status, serverMin, send, ...statusActions(setStatus) };
}

function statusActions(setStatus: Dispatch<SetStateAction<VoidStatus>>) {
  return {
    reset: () => {
      setStatus({ kind: "editing" });
    },
    markTooShort: () => {
      setStatus({ kind: "tooShort" });
    },
    markFailed: (failure: VoidFailure) => {
      setStatus({ kind: "failed", failure });
    },
  };
}
