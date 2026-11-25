import { useEffect, useRef } from "react";
import type { StartInput } from "./new-draft.ts";
import type { M09Model } from "./use-m-09.ts";

/**
 * Starts the action (replace, move, retire) by itself the first time the screen has its data, so
 * the courier lands on the first question. A saved action is never replaced by a new one here.
 */
export function useAutoBegin(model: M09Model, input: StartInput): void {
  const hasBegun = useRef(false);
  const { state, run, service, refresh } = model;
  useEffect(() => {
    if (state === null || hasBegun.current) return;
    hasBegun.current = true;
    const isOpenDraft = state.draft !== null && state.event === null && !state.isShiftBlocked;
    const eventId = state.draft?.eventId ?? null;
    void (async () => {
      if (!isOpenDraft) await run(() => service.start(input, eventId), eventId, true);
      await updateConfiguration(service, refresh);
    })();
  }, [state, run, service, refresh, input]);
}

/** Background: never blocks the first question; offline keeps the last downloaded lists. */
async function updateConfiguration(
  service: M09Model["service"],
  refresh: M09Model["refresh"],
): Promise<void> {
  try {
    const current = await service.read();
    if (current.event) return;
    await service.updateConfiguration(current.draft?.eventId ?? null);
    await refresh();
  } catch {
    // A changed session or draft has its own notice; the reason page offers a retry.
  }
}
