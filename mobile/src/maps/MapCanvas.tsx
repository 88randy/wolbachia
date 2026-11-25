import { Camera, Map } from "@maplibre/maplibre-react-native";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { useMemo, useState } from "react";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { MapPointDots } from "./MapPointDots.tsx";
import { MapPointMarkers } from "./MapPointMarkers.tsx";
import { MapTrackLine } from "./MapTrackLine.tsx";
import { MapZoneLayers } from "./MapZoneLayers.tsx";
import { initialViewFor } from "./map-geo.ts";
import { createMapStyles } from "./map-styles.ts";
import type { LngLatPair, MapPoint, MapZone } from "./map-types.ts";
import { OVERVIEW_ZOOM } from "./map-zoom.ts";
import { MapUserLocation } from "./MapUserLocation.tsx";

interface Props {
  readonly mapStyle: StyleSpecification;
  readonly points: readonly MapPoint[];
  readonly zones: readonly MapZone[];
  readonly lines: readonly (readonly LngLatPair[])[];
  readonly selectedId: string | null;
  readonly onSelectPoint: (id: string) => void;
}

/**
 * Native boundary. Labels appear by zoom so they never pile up: dots first, zone names when
 * closer, point codes when close. The selected point always keeps its code.
 */
export function MapCanvas({ mapStyle, points, zones, lines, selectedId, onSelectPoint }: Props) {
  const styles = useStyles(createMapStyles);
  const t = useT();
  const view = useMemo(() => initialViewFor(points, zones, lines), [points, zones, lines]);
  const [zoom, setZoom] = useState(OVERVIEW_ZOOM);
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
      <MapZoneLayers zones={zones} zoom={zoom} />
      <MapTrackLine lines={lines} />
      <MapPointDots points={points} />
      <MapUserLocation />
      <MapPointMarkers
        points={points}
        zoom={zoom}
        selectedId={selectedId}
        onSelect={onSelectPoint}
      />
    </Map>
  );
}
