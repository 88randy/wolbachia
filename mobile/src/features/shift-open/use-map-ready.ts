import { useEffect } from "react";
import { isMapReady } from "./domain.ts";
import type { M04Model } from "./use-m-04.ts";

/** Starts getting the offline map as soon as the last step opens, once, with no button. */
export function useMapReady(model: M04Model): void {
  const { state, service, refresh } = model;
  const shouldPrepare =
    state !== null && state.map?.status !== "preparing" && !isMapReady(state.map);
  useEffect(() => {
    if (shouldPrepare) void service.prepareMap().then(refresh, () => undefined);
    // Once per visit: a failed attempt is retried by the button, not by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
