import { useEffect, useRef } from "react";
import type { StartInput } from "./new-draft.ts";
import type { M09Model } from "./use-m-09.ts";

/**
 * Starts the action (replace, move, retire) by itself the first time the screen has its data, so
 * the courier lands on the first question. A saved action is never replaced by a new one here.
 */
export function useAutoBegin(model: M09Model, input: StartInput): void {
  const hasBegun = useRef(false);
  const { state, run, service } = model;
  useEffect(() => {
    if (state === null || hasBegun.current) return;
    hasBegun.current = true;
    const isOpenDraft = state.draft !== null && state.event === null && !state.isShiftBlocked;
    if (isOpenDraft) return;
    const eventId = state.draft?.eventId ?? null;
    void run(() => service.start(input, eventId), eventId, true);
  }, [state, run, service, input]);
}
