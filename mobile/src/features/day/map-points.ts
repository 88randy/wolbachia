import type { MessageKey } from "@wolbachia/i18n";
import type { MapPoint } from "../../maps/map-types.ts";
import { hasCoordinates } from "./assignment-parser.ts";
import type { DayTask } from "./domain.ts";
import { markerState } from "./presentation.ts";

/** Route points that have coordinates, as map points: status is always icon plus words. */
export function toMapPoints(
  rows: readonly DayTask[],
  translate: (key: MessageKey) => string,
): readonly MapPoint[] {
  return rows.flatMap((row) => {
    if (!hasCoordinates(row.task)) return [];
    const state = markerState(row);
    return [
      {
        id: row.task.id,
        lat: row.task.lat,
        lng: row.task.lng,
        label: row.task.point_code,
        statusLabel: translate(state.key),
        tone: state.tone,
        icon: state.icon,
      },
    ];
  });
}
