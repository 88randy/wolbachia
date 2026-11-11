import { Camera, Map, UserLocation } from "@maplibre/maplibre-react-native";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { useMemo, useState } from "react";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { MapPointDots } from "./MapPointDots.tsx";
import { MapPointMarker } from "./MapPointMarker.tsx";
import { MapZoneLayer } from "./MapZoneLayer.tsx";
import { initialViewFor } from "./map-geo.ts";
import { createMapStyles } from "./map-styles.ts";
import type { MapPoint, MapZone } from "./map-types.ts";
import { OVERVIEW_ZOOM, POINT_LABEL_ZOOM, ZONE_LABEL_ZOOM } from "./map-zoom.ts";
import { useLocationGranted } from "./use-location-granted.ts";

interface Props {
  readonly mapStyle: StyleSpecification;
  readonly points: readonly MapPoint[];
  readonly zones: readonly MapZone[];
  readonly selectedId: string | null;
  readonly onSelectPoint: (id: string) => void;
}

/**
 * Native boundary. Labels appear by zoom so they never pile up: dots first, zone names when
 * closer, point codes when close. The selected point always keeps its code.
 */
export function MapCanvas({ mapStyle, points, zones, selectedId, onSelectPoint }: Props) {
  const styles = useStyles(createMapStyles);
  const t = useT();
  const hasLocation = useLocationGranted();
  const view = useMemo(() => initialViewFor(points, zones), [points, zones]);
  const [zoom, setZoom] = useState(OVERVIEW_ZOOM);
  const markers = points.filter((point) => zoom >= POINT_LABEL_ZOOM || point.id === selectedId);
  return (
    <Map
      style={styles.map}
      mapStyle={mapStyle}
      accessibilityLabel={t("mobile.map.label")}
      attribution={false}
      logo={false}
      onRegionDidChange={(event) => {
        setZoom(event.nativeEvent.zoom);
      }}
    >
      <Camera initialViewState={view} />
      {zones.map((zone) => (
        <MapZoneLayer key={zone.id} zone={zone} showLabel={zoom >= ZONE_LABEL_ZOOM} />
      ))}
      <MapPointDots points={points} />
      {hasLocation ? <UserLocation accuracy /> : null}
      {markers.map((point) => (
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
