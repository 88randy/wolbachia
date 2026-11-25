import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import { useTheme } from "../theme/ThemeProvider.tsx";
import type { LngLatPair } from "./map-types.ts";

const SOURCE = "own-track";

/** Drawable lines only: a single fix is no LineString. */
function trackFeature(
  lines: readonly (readonly LngLatPair[])[],
): GeoJSON.Feature<GeoJSON.MultiLineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiLineString",
      coordinates: lines
        .filter((line) => line.length >= 2)
        .map((line) => line.map(([lng, lat]) => [lng, lat])),
    },
  };
}

/**
 * The courier's own track: one line per shift (MultiLineString, so two shifts never join), on a
 * surface-colored casing so it reads on any tile. A single fix is no line.
 */
export function MapTrackLine({ lines }: { readonly lines: readonly (readonly LngLatPair[])[] }) {
  const { theme } = useTheme();
  const data = useMemo(() => trackFeature(lines), [lines]);
  if (data.geometry.coordinates.length === 0) return null;
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
