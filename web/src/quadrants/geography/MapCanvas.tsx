import { useTranslation } from "react-i18next";
import Map from "react-map-gl/maplibre";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { MapProps } from "./map-types";
import type { MapSource } from "./map-source";
import { MAX_MAP_ZOOM } from "./map-source";
import { baseMapStyle, initialMapView } from "./map-features";
import { GeographyLayers } from "./GeographyLayers";
import type { LayerVisibility } from "./use-map-display";
import styles from "./geography.module.css";
import { MapAttribution } from "./MapAttribution";
import { AreaLabels } from "./AreaLabels";
interface Props {
  features: MapProps;
  source: MapSource;
  visible: LayerVisibility;
  onFailure: () => void;
}
export function MapCanvas({ features, source, visible, onFailure }: Props) {
  const { t } = useTranslation();
  const view = initialMapView(features);
  const viewKey = "bounds" in view ? JSON.stringify(view.bounds) : "world";
  const options = {
    locale: { "Map.Title": t("geography.map.label") },
    initialViewState: view,
    mapStyle: baseMapStyle(source),
    maxZoom: MAX_MAP_ZOOM,
    // Vite bundles the v6 worker and its shared ESM dependencies into one same-origin asset.
    workerUrl,
    attributionControl: false as const,
    onError: onFailure,
    onClick: (event: { lngLat: { lng: number; lat: number } }) => {
      features.onVertex?.([event.lngLat.lng, event.lngLat.lat]);
    },
  };
  return (
    <div className={styles.canvas}>
      <Map key={viewKey} {...options}>
        <GeographyLayers features={features} visible={visible} />
        <AreaLabels quadrants={features.quadrants} blocks={features.blocks} />
        <MapAttribution source={source.attribution} />
      </Map>
    </div>
  );
}
