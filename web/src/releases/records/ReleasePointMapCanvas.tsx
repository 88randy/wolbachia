import { MapPin } from "lucide-react";
import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useTranslation } from "react-i18next";
import { baseMapStyle } from "../../quadrants/geography/map-features";
import { MAX_MAP_ZOOM } from "../../quadrants/geography/map-source";
import type { MapSource } from "../../quadrants/geography/map-source";
import { MapAttribution } from "../../quadrants/geography/MapAttribution";

const POINT_ZOOM = 16;

interface Props {
  point: { lng: number; lat: number };
  source: MapSource;
  onFailure: () => void;
}

/** One marker on the base map; loaded lazily so the map library stays out of the main bundle. */
export function ReleasePointMapCanvas({ point, source, onFailure }: Props) {
  const { t } = useTranslation();
  return (
    <Map
      initialViewState={{ longitude: point.lng, latitude: point.lat, zoom: POINT_ZOOM }}
      mapStyle={baseMapStyle(source)}
      maxZoom={MAX_MAP_ZOOM}
      workerUrl={workerUrl}
      attributionControl={false}
      onError={onFailure}
      locale={{ "Map.Title": t("releases.detail.point") }}
    >
      <Marker anchor="bottom" longitude={point.lng} latitude={point.lat}>
        <MapPin aria-hidden="true" className="size-8 fill-action text-surface" />
      </Marker>
      <MapAttribution source={source.attribution} />
    </Map>
  );
}
