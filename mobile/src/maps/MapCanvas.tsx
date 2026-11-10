import { Camera, Map, UserLocation } from "@maplibre/maplibre-react-native";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { MapPointMarker } from "./MapPointMarker.tsx";
import { MapZoneLayer } from "./MapZoneLayer.tsx";
import { initialViewFor } from "./map-geo.ts";
import { createMapStyles } from "./map-styles.ts";
import type { MapPoint, MapZone } from "./map-types.ts";
import { useLocationGranted } from "./use-location-granted.ts";

interface Props {
  readonly mapStyle: StyleSpecification;
  readonly points: readonly MapPoint[];
  readonly zones: readonly MapZone[];
  readonly selectedId: string | null;
  readonly onSelectPoint: (id: string) => void;
}

/** Native boundary: the map with zones, points and the user location. */
export function MapCanvas({ mapStyle, points, zones, selectedId, onSelectPoint }: Props) {
  const styles = useStyles(createMapStyles);
  const t = useT();
  const hasLocation = useLocationGranted();
  const view = useMemo(() => initialViewFor(points, zones), [points, zones]);
  return (
    <Map
      style={styles.map}
      mapStyle={mapStyle}
      accessibilityLabel={t("mobile.map.label")}
      attribution={false}
    >
      <Camera initialViewState={view} />
      {zones.map((zone) => (
        <MapZoneLayer key={zone.id} zone={zone} />
      ))}
      {hasLocation ? <UserLocation accuracy /> : null}
      {points.map((point) => (
        <MapPointMarker
          key={point.id}
          point={point}
          isSelected={point.id === selectedId}
          onSelect={onSelectPoint}
        />
      ))}
    </Map>
  );
}
