import { useEffect } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { useInventoryContext } from "../use-inventory-context";
import { interruptedCapture, EMPTY_CAPTURE, INITIAL_CAPTURE } from "./condition-capture-state";
import type { CaptureState, CaptureValues } from "./condition-capture-state";
export function useCaptureRetirement(options: {
  scope: ReturnType<typeof useInventoryContext>;
  attempt: RefObject<symbol | null>;
  setState: Dispatch<SetStateAction<CaptureState>>;
  setValues: Dispatch<SetStateAction<CaptureValues>>;
  isDenied: boolean;
}) {
  const { scope, attempt, setState, setValues, isDenied } = options;
  useEffect(() => {
    attempt.current = null;
    setState(interruptedCapture);
  }, [scope.identity.revision, scope.context, attempt, setState]);
  useEffect(() => {
    if (!isDenied) return;
    attempt.current = null;
    setState(INITIAL_CAPTURE);
    setValues({ ...EMPTY_CAPTURE });
  }, [isDenied, attempt, setState, setValues]);
}
