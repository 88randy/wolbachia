import { useMemo } from "react";
import { View } from "react-native";
import { useStyles, useTheme } from "../theme/ThemeProvider.tsx";
import { MapCanvas } from "./MapCanvas.tsx";
import { MapFooter } from "./MapFooter.tsx";
import { MapUnavailable } from "./MapUnavailable.tsx";
import { buildMapStyle } from "./map-style.ts";
import { createMapStyles } from "./map-styles.ts";
import type { MapPoint, MapZone } from "./map-types.ts";
import { useMapTiles } from "./use-map-tiles.ts";

interface Props {
  readonly points?: readonly MapPoint[];
  readonly zones?: readonly MapZone[];
  /** Highlighted point; the directions button targets it. */
  readonly selectedId?: string | null;
  readonly onSelectPoint?: (id: string) => void;
  /** Shows the directions button under the map when a point is selected. Default true. */
  readonly showDirections?: boolean;
}

const NO_POINTS: readonly MapPoint[] = [];
const NO_ZONES: readonly MapZone[] = [];

/**
 * Embeddable offline map: quadrants as polygons (color + dash pattern + label), points with
 * status icon + text, the user location and a big directions button. Tiles come from our own
 * extract, downloaded once and kept on the device. Place it inside a plain flex View.
 */
export function MapView({
  points = NO_POINTS,
  zones = NO_ZONES,
  selectedId = null,
  onSelectPoint,
  showDirections = true,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles(createMapStyles);
  const { state, retry } = useMapTiles();
  const uri = state.kind === "ready" ? state.uri : null;
  const mapStyle = useMemo(() => (uri === null ? null : buildMapStyle(uri, theme)), [uri, theme]);
  if (mapStyle === null)
    return <MapUnavailable isLoading={state.kind === "loading"} onRetry={retry} />;
  return (
    <View style={styles.root}>
      <MapCanvas
        mapStyle={mapStyle}
        points={points}
        zones={zones}
        selectedId={selectedId}
        onSelectPoint={(id) => onSelectPoint?.(id)}
      />
      <MapFooter
        point={points.find((point) => point.id === selectedId) ?? null}
        showDirections={showDirections}
      />
    </View>
  );
}
