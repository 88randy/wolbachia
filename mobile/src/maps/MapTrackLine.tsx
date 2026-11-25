import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import { useTheme } from "../theme/ThemeProvider.tsx";
import type { LngLatPair } from "./map-types.ts";

const SOURCE = "own-track";

/** The courier's own day track: a line on a surface-colored casing so it reads on any tile. */
export function MapTrackLine({ line }: { readonly line: readonly LngLatPair[] }) {
  const { theme } = useTheme();
  const data = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: line.map(([lng, lat]) => [lng, lat]) },
    }),
    [line],
  );
  if (line.length < 2) return null;
  return (
    <GeoJSONSource id={SOURCE} data={data}>
      <Layer
        id={`${SOURCE}-casing`}
        type="line"
        source={SOURCE}
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{ "line-color": theme.color.surface, "line-width": 7 }}
      />
      <Layer
        id={`${SOURCE}-line`}
        type="line"
        source={SOURCE}
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{ "line-color": theme.color.status.info.fg, "line-width": 4 }}
      />
    </GeoJSONSource>
  );
}
