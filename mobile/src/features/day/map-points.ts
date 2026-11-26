import type { MessageKey } from "@wolbachia/i18n";
import type { MapPoint } from "../../maps/map-types.ts";
import { hasCoordinates } from "./assignment-parser.ts";
import type { DayTask } from "./domain.ts";
import { displayPointCode } from "./point-code.ts";
import { ACTION_KEYS, markerState } from "./presentation.ts";

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
        label: displayPointCode(row.task.point_code),
        statusLabel: translate(state.key),
        tone: state.tone,
        icon: state.icon,
        actionLabel: translate(ACTION_KEYS[row.task.action]),
        isStartable: row.completion !== "complete",
      },
    ];
  });
}

/** Only the quadrants of today's tasks: the map never shows the rest of the organization. */
export function zonesOfTasks<Zone extends { readonly id: string }>(
  zones: readonly Zone[],
  rows: readonly DayTask[],
): readonly Zone[] {
  const mine = new Set(rows.map((row) => row.task.quadrant_id));
  return zones.filter((zone) => mine.has(zone.id));
}
