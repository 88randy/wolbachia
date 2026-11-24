import { useEffect, useState, useSyncExternalStore } from "react";
import { useServices } from "../../app/services-context.ts";
import type { LngLatPair } from "../../maps/map-types.ts";

const NO_LINE: readonly LngLatPair[] = [];

/** The current shift's own track from the phone's points (works offline). */
export function useOwnTrack(): readonly LngLatPair[] {
  const { track } = useServices();
  const { revision } = useSyncExternalStore(track.subscribe, track.getSnapshot);
  const [line, setLine] = useState(NO_LINE);
  useEffect(() => {
    let isCurrent = true;
    void track.currentLine().then((points) => {
      if (isCurrent) setLine(points.map((point): LngLatPair => [point.lng, point.lat]));
    });
    return () => {
      isCurrent = false;
    };
  }, [track, revision]);
  return line;
}
