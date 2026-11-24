import { useEffect, useState, useSyncExternalStore } from "react";
import { useServices } from "../../app/services-context.ts";
import type { LngLatPair } from "../../maps/map-types.ts";
import type { TrackNotice } from "./track-recorder.ts";

const NO_LINE: readonly LngLatPair[] = [];

/** The current shift's own track from the phone (works offline) and the recorder's notice. */
export function useOwnTrack(): {
  readonly line: readonly LngLatPair[];
  readonly notice: TrackNotice;
} {
  const { track } = useServices();
  const snapshot = useSyncExternalStore(track.subscribe, track.getSnapshot);
  const [line, setLine] = useState(NO_LINE);
  useEffect(() => {
    let isCurrent = true;
    void track.currentLine().then((points) => {
      if (isCurrent) setLine(points.map((point): LngLatPair => [point.lng, point.lat]));
    });
    return () => {
      isCurrent = false;
    };
  }, [track, snapshot.revision]);
  return { line, notice: snapshot.notice };
}
