import Map, { NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

// Compile/bundle check only (not run in tests: WebGL is not available in jsdom).
// OSM raster tiles + the required attribution.
const style = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export default function MapPoc() {
  return (
    <Map initialViewState={{ longitude: -99.13, latitude: 19.43, zoom: 10 }} style={{ width: "100%", height: 400 }} mapStyle={style}>
      <NavigationControl />
    </Map>
  );
}
