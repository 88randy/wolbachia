import { useEffect, useState, useSyncExternalStore } from "react";
import { useServices } from "../../app/services-context.ts";
import type { LngLatPair } from "../../maps/map-types.ts";

export type DayLines = readonly (readonly LngLatPair[])[];
/** What P33 shows about a day's route; `hidden` for future or not-kept days. */
export type DayRoute = "loading" | "lines" | "pruned" | "none" | "hidden";

/**
 * No lines: a local `shift.open` that day means the points were pruned; without one there was
 * no route at all (#373 behavior 7).
 */
export function dayRouteOf(lines: DayLines | null, hadShift: boolean): DayRoute {
  if (lines === null) return "loading";
  if (lines.length > 0) return "lines";
  return hadShift ? "pruned" : "none";
}

/** The owner's lines of one local date (null = loading); re-read when the live track grows. */
export function useDayLines(date: string | null, timeZone: string): DayLines | null {
  const { track } = useServices();
  const { revision } = useSyncExternalStore(track.subscribe, track.getSnapshot);
  const [result, setResult] = useState<{ readonly key: string; readonly lines: DayLines } | null>(
    null,
  );
  const key = `${date ?? ""}|${timeZone}`;
  useEffect(() => {
    if (date === null) return;
    let isCurrent = true;
    void track.linesForDay(date, timeZone).then((lines) => {
      if (isCurrent) setResult({ key: `${date}|${timeZone}`, lines });
    });
    return () => {
      isCurrent = false;
    };
  }, [track, date, timeZone, revision]);
  // Another day's lines are never shown; the same day keeps its line while a new fix is read.
  return result?.key === key ? result.lines : null;
}
