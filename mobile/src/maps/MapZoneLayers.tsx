import { MapZoneLayer } from "./MapZoneLayer.tsx";
import type { MapZone } from "./map-types.ts";
import { ZONE_LABEL_ZOOM } from "./map-zoom.ts";

/** Every zone polygon; names only once zoomed in enough to read them. */
export function MapZoneLayers({
  zones,
  zoom,
}: {
  readonly zones: readonly MapZone[];
  readonly zoom: number;
}) {
  return zones.map((zone) => (
    <MapZoneLayer key={zone.id} zone={zone} showLabel={zoom >= ZONE_LABEL_ZOOM} />
  ));
}
