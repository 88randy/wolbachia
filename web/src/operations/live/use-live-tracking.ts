import type { Schemas } from "@wolbachia/api-client";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { MapCourier } from "../../quadrants/geography/map-types";
import { positionAge, trackLines } from "../track/track-model";
import { useCourierPositions, useShiftTrack } from "../track/track-queries";

/** A focused courier's track is loaded once and refreshed every 2 minutes. */
const TRACK_REFRESH_MS = 120_000;

export type LivePosition = Schemas["LastPosition"] & ReturnType<typeof positionAge>;

/** A dot per position: a stale one carries its age in the label, never only in its style. */
function courierDots(
  positions: readonly LivePosition[],
  nameOf: (id: string) => string,
  t: TFunction,
): MapCourier[] {
  return positions.map((position) => {
    const name = nameOf(position.courier);
    return {
      id: position.shift_id,
      label: position.isStale
        ? t("live.position.staleLabel", { name, minutes: position.minutes })
        : name,
      at: [position.lng, position.lat],
      isStale: position.isStale,
    };
  });
}

/** W28 positions (with their age at the last refresh) and the focused courier's track. */
export function useLiveTracking(shifts: readonly Schemas["Shift"][], courier: string | undefined) {
  const { t } = useTranslation();
  const { canTrack, query } = useCourierPositions();
  const focused = courier ? shifts.find((shift) => shift.courier === courier) : undefined;
  const track = useShiftTrack(focused?.id, TRACK_REFRESH_MS);
  const positions: LivePosition[] = (query.data ?? []).map((position) => ({
    ...position,
    ...positionAge(position.recorded_at, query.dataUpdatedAt),
  }));
  const shown = positions.filter((position) => !courier || position.courier === courier);
  return {
    canTrack,
    positionOf: (shiftId: string) => positions.find((position) => position.shift_id === shiftId),
    mapCouriers: (nameOf: (id: string) => string) => courierDots(shown, nameOf, t),
    // Another courier's track is never shown as a placeholder for this one.
    track:
      track.query.data && !track.query.isPlaceholderData
        ? trackLines(track.query.data.segments)
        : [],
    errors: [
      ...(query.isError ? (["live.position.error"] as const) : []),
      ...(track.query.isError ? (["live.track.error"] as const) : []),
    ],
  };
}
