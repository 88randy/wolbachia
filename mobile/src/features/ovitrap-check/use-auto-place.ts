import { useEffect, useRef } from "react";
import type { M08Model } from "./use-m-08.ts";

/**
 * "Empezar" on a place task of the route: once the lists are downloaded, start the placing
 * wizard and choose that point, so the courier never sees the chooser or the point picker.
 */
export function useAutoPlace(model: M08Model, pointId: string | undefined, isReady: boolean): void {
  const started = useRef(false);
  const state = model.state;
  const draft = state?.draft ?? null;
  useEffect(() => {
    if (!pointId || !isReady || started.current || state === null) return;
    if (draft !== null || state.event !== null || !state.canStartCapture) return;
    started.current = true;
    void model.run(() => model.service.startPlace(null), { eventId: null, startsCapture: true });
    // The model object changes each render; the facts above decide when to start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointId, isReady, state, draft]);
  useEffect(() => {
    // An old draft waits for the courier to choose; it is never edited before that.
    if (state?.staleDraft) return;
    if (!pointId || draft === null || draft.mode !== "place" || draft.point !== null) return;
    const point = draft.assignment?.points.find((item) => item.id === pointId);
    if (point) model.edit({ point }, draft.eventId);
    // Choose once per draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointId, draft?.eventId, draft?.point, draft?.assignment, state?.staleDraft]);
}
