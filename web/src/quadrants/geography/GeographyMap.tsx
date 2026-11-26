import "maplibre-gl/dist/maplibre-gl.css";
import type { MapProps } from "./map-types";
import { MapFallback } from "./MapFallback";
import { useMapDisplay } from "./use-map-display";
import { LayerControls } from "./LayerControls";
import { MapCanvas } from "./MapCanvas";
import { CenterLegend } from "./CenterLegend";
/** This module and MapLibre are imported only after opening the map. */
export default function GeographyMap(props: MapProps) {
  const map = useMapDisplay();
  if (map.hasFailed || !map.source) return <MapFallback />;
  return (
    <div>
      <LayerControls visible={map.visible} onChange={map.setVisible} />
      <MapCanvas features={props} source={map.source} visible={map.visible} onFailure={map.fail} />
      <CenterLegend quadrants={props.quadrants} />
    </div>
  );
}
