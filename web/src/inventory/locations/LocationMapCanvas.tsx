import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { Schemas } from "@wolbachia/api-client";
import { spacing } from "@wolbachia/tokens";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Package, ShieldCheck } from "lucide-react";
import { baseMapStyle } from "../../quadrants/geography/map-features";
import { MAX_MAP_ZOOM } from "../../quadrants/geography/map-source";
import type { MapSource } from "../../quadrants/geography/map-source";
import styles from "../inventory.module.css";
type Location = Schemas["Location"];
const markerPadding = {
  left: spacing[6] + spacing[2],
  right: spacing[6] + spacing[2],
  top: spacing[6] * 2 + spacing[3],
  bottom: spacing[6] * 2 + spacing[3],
};
function locationBounds(locations: readonly Location[]): [[number, number], [number, number]] {
  const longitudes = locations.map((row) => Number(row.geometry.coordinates[0]));
  const latitudes = locations.map((row) => Number(row.geometry.coordinates[1]));
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}
function LocationMarker({ location }: { location: Location }) {
  return (
    <Marker
      anchor="center"
      longitude={Number(location.geometry.coordinates[0])}
      latitude={Number(location.geometry.coordinates[1])}
    >
      <Link
        className={styles.marker}
        to="/inventory/locations/$code"
        params={{ code: location.code }}
        search={{ center: location.center }}
      >
        {location.is_insecticide_free ? (
          <ShieldCheck aria-hidden="true" />
        ) : (
          <Package aria-hidden="true" />
        )}
        {location.name}
        <MarkerSafety location={location} />
      </Link>
    </Marker>
  );
}
function MarkerSafety({ location }: { location: Location }) {
  const { t } = useTranslation();
  const key =
    location.is_insecticide_free === null
      ? "inventory.state.unconfigured"
      : location.is_insecticide_free
        ? "inventory.option.yes"
        : "inventory.option.no";
  return (
    <span>
      {t("inventory.field.isInsecticideFree")}: {t(key)}
    </span>
  );
}
export function LocationMapCanvas({
  locations,
  source,
  onFailure,
}: {
  locations: readonly Location[];
  source: MapSource;
  onFailure: () => void;
}) {
  const { t } = useTranslation();
  const view = {
    bounds: locationBounds(locations),
    fitBoundsOptions: { padding: markerPadding, maxZoom: MAX_MAP_ZOOM },
  };
  return (
    <Map
      initialViewState={view}
      mapStyle={baseMapStyle(source)}
      maxZoom={MAX_MAP_ZOOM}
      workerUrl={workerUrl}
      attributionControl={false}
      onError={onFailure}
      locale={{ "Map.Title": t("inventory.section.map") }}
    >
      {locations.map((location) => (
        <LocationMarker key={location.id} location={location} />
      ))}
    </Map>
  );
}
