import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import { useTheme } from "../theme/ThemeProvider.tsx";
import type { MapPoint } from "./map-types.ts";

const SOURCE = "route-points";

/** Overview of the route points: small dots without labels, drawn under every label. */
export function MapPointDots({ points }: { readonly points: readonly MapPoint[] }) {
  const { theme } = useTheme();
  const data = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: points.map((point) => ({
        type: "Feature",
        properties: { id: point.id },
        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      })),
    }),
    [points],
  );
  return (
    <GeoJSONSource id={SOURCE} data={data}>
      <Layer
        id={`${SOURCE}-dots`}
        type="circle"
        source={SOURCE}
        paint={{
          "circle-radius": 5,
          "circle-color": theme.color.action,
          "circle-stroke-color": theme.color.surface,
          "circle-stroke-width": 2,
        }}
      />
    </GeoJSONSource>
  );
}
