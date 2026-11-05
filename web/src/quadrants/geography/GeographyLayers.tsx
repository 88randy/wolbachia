import { Source, Layer } from "react-map-gl/maplibre";
import type { MapProps } from "./map-types";
import type { LayerVisibility } from "./use-map-display";
import { mapFeatures } from "./map-features";
import { useMapTheme } from "./use-map-theme";
import { polygonLayers, pointLayer } from "./map-layer-definitions";
export function GeographyLayers({
  features,
  visible,
}: {
  features: MapProps;
  visible: LayerVisibility;
}) {
  const collections = mapFeatures(features);
  const colors = useMapTheme();
  return (
    <>
      <Source id="geography-polygons" type="geojson" data={collections.polygons}>
        {polygonLayers({ colors, visible }).map((layer) => (
          <Layer key={layer.id} {...layer} />
        ))}
      </Source>
      {visible.points && (
        <Source id="geography-points" type="geojson" data={collections.points}>
          <Layer {...pointLayer(colors)} />
        </Source>
      )}
    </>
  );
}
