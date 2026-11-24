import { MapPointMarker } from "./MapPointMarker.tsx";
import type { MapPoint } from "./map-types.ts";
import { POINT_LABEL_ZOOM } from "./map-zoom.ts";

/** Labelled markers when close enough to read them; the selected point always keeps its code. */
export function MapPointMarkers({
  points,
  zoom,
  selectedId,
  onSelect,
}: {
  readonly points: readonly MapPoint[];
  readonly zoom: number;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  return points
    .filter((point) => zoom >= POINT_LABEL_ZOOM || point.id === selectedId)
    .map((point) => (
      <MapPointMarker
        key={point.id}
        point={point}
        isSelected={point.id === selectedId}
        onSelect={onSelect}
      />
    ));
}
