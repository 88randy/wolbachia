import { useEffect, useRef, useState } from "react";
import type { SyntheticEvent, RefObject } from "react";
import type { ReceptionActions } from "./use-reception-command";
import { normalizeBagCode, isBagCodeValid } from "./reception-command";
import { useReceptionScanQueue } from "./use-reception-scan-queue";

function reviewAction(actions: ReceptionActions) {
  return () => {
    void actions.review();
  };
}

function useScannerFocus(input: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    let isMounted = true;
    // Shell navigation focuses main in its effect; the scanner is the next keyboard destination.
    queueMicrotask(() => {
      if (isMounted) input.current?.focus();
    });
    return () => {
      isMounted = false;
    };
  }, [input]);
}
/** A submitted code clears once; edits for the next scan remain in their own field. */
export function useReceptionScanner(actions: ReceptionActions) {
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const queue = useReceptionScanQueue(actions);
  useScannerFocus(input);
  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (actions.isReviewRequired || !actions.canSubmit) return;
    const normalized = normalizeBagCode(code);
    if (!isBagCodeValid(normalized)) {
      actions.setResult({ code: "invalid" });
      return;
    }
    setCode("");
    queue.enqueue(normalized);
    input.current?.focus();
  }
  return {
    input,
    code,
    setCode,
    pendingCount: queue.pendingCount,
    submit,
    review: reviewAction(actions),
  };
}
