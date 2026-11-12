/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): map wiring, split after the demo. */
import { useMemo, useRef, useState } from "react";
import Map, { Marker, Popup } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { spacing } from "@wolbachia/tokens";
import { useTranslation } from "react-i18next";
import { baseMapStyle } from "../../quadrants/geography/map-features";
import { MAX_MAP_ZOOM } from "../../quadrants/geography/map-source";
import type { MapSource } from "../../quadrants/geography/map-source";
import { MapAttribution } from "../../quadrants/geography/MapAttribution";
import { EntityName } from "../../lookups/EntityName";
import { LocationPin } from "./LocationPin";
import { LocationPopupContent } from "./LocationPopupContent";
import { clusterLocations, initialView } from "./location-pins";
import type { Location, LocationCluster } from "./location-pins";
import { usePinSelection } from "./use-pin-selection";
import styles from "../inventory.module.css";

const fitPadding = {
  left: spacing[6] * 2,
  right: spacing[6] * 2,
  top: spacing[6] * 2,
  bottom: spacing[6] * 2,
};
/** Zoom is bucketed to quarter steps so panning/zooming does not re-cluster on every frame. */
const ZOOM_STEP = 4;
/** Gap between a pin and its popup, in px. */
const POPUP_OFFSET = spacing[3];
/** Share of the map height the pin moves down so a popup above it is not clipped. */
const POPUP_ROOM = 0.5;

function bucket(zoom: number): number {
  return Math.round(zoom * ZOOM_STEP) / ZOOM_STEP;
}

function centerName(id: string) {
  return <EntityName kind="center" id={id} />;
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
  const [zoom, setZoom] = useState<number | null>(null);
  const mapRef = useRef<MapRef>(null);
  const { selectedKey, open, close } = usePinSelection();
  const openPin = (cluster: LocationCluster, element: HTMLElement) => {
    open(cluster.key, element);
    const map = mapRef.current;
    // Park the pin low in the frame so its popup has room above it.
    map?.easeTo({
      center: [cluster.longitude, cluster.latitude],
      offset: [0, (map.getContainer().clientHeight * POPUP_ROOM) / 2],
    });
  };
  const view = useMemo(() => initialView(locations), [locations]);
  const clusters = useMemo(
    () => (zoom === null ? [] : clusterLocations(locations, zoom)),
    [locations, zoom],
  );
  const selected = clusters.find((cluster) => cluster.key === selectedKey);
  return (
    <Map
      ref={mapRef}
      initialViewState={
        "bounds" in view
          ? {
              bounds: view.bounds,
              fitBoundsOptions: { padding: fitPadding, maxZoom: view.maxZoom },
            }
          : view
      }
      mapStyle={baseMapStyle(source)}
      maxZoom={MAX_MAP_ZOOM}
      workerUrl={workerUrl}
      attributionControl={false}
      onError={onFailure}
      onLoad={(event) => {
        setZoom(bucket(event.target.getZoom()));
      }}
      onZoomEnd={(event) => {
        setZoom(bucket(event.target.getZoom()));
      }}
      onClick={() => {
        close(false);
      }}
      locale={{ "Map.Title": t("inventory.section.map") }}
    >
      {clusters.map((cluster) => (
        <Marker
          key={cluster.key}
          anchor="center"
          longitude={cluster.longitude}
          latitude={cluster.latitude}
          style={selected?.key === cluster.key ? { zIndex: 3 } : undefined}
        >
          <LocationPin
            cluster={cluster}
            expanded={selected?.key === cluster.key}
            onOpen={(_key, element) => {
              openPin(cluster, element);
            }}
          />
        </Marker>
      ))}
      {selected && (
        <Popup
          longitude={selected.longitude}
          latitude={selected.latitude}
          offset={POPUP_OFFSET}
          maxWidth="none"
          closeButton={false}
          closeOnClick={false}
          closeOnMove={false}
          className={styles.popupShell}
        >
          <LocationPopupContent
            cluster={selected}
            centerName={centerName}
            onClose={() => {
              close(true);
            }}
          />
        </Popup>
      )}
      <MapAttribution source={source.attribution} />
    </Map>
  );
}
