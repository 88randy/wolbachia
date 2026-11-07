import { useEffect, useRef } from "react";
import type { M08Model } from "./use-m-08.ts";

/** Retire UI callbacks on unmount/draft replacement; native work keeps its own lease. */
export function usePhotoCapture(model: M08Model, eventId: string) {
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [eventId],
  );
  return () => {
    if (active.current) return;
    const request = new AbortController();
    active.current = request;
    void model
      .run(() => model.service.captureEvidence(eventId, request.signal), {
        eventId,
        signal: request.signal,
      })
      .finally(() => {
        if (active.current === request) active.current = null;
      });
  };
}
