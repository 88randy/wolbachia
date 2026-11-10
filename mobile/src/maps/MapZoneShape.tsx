import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { dashFor, zoneFeature } from "./map-geo.ts";
import type { MapZone } from "./map-types.ts";

/** Tinted fill plus an outline whose dash pattern differs per zone (color + pattern). */
export function MapZoneShape({ zone }: { readonly zone: MapZone }) {
  const { theme } = useTheme();
  const color = theme.color.status[zone.tone].fg;
  const dash = dashFor(zone.patternIndex);
  const sourceId = `zone-${zone.id}`;
  return (
    <GeoJSONSource id={sourceId} data={zoneFeature(zone)}>
      <Layer
        id={`${sourceId}-fill`}
        type="fill"
        source={sourceId}
        paint={{ "fill-color": color, "fill-opacity": 0.14 }}
      />
      <Layer
        id={`${sourceId}-line`}
        type="line"
        source={sourceId}
        paint={{
          "line-color": color,
          "line-width": 3,
          ...(dash === null ? {} : { "line-dasharray": [...dash] }),
        }}
      />
    </GeoJSONSource>
  );
}
