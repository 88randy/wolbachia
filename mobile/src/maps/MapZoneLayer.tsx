import { ViewAnnotation } from "@maplibre/maplibre-react-native";
import { View } from "react-native";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "../ui/AppText.tsx";
import { MapZoneShape } from "./MapZoneShape.tsx";
import { centroidOf } from "./map-geo.ts";
import { createMapStyles } from "./map-styles.ts";
import type { MapZone } from "./map-types.ts";

/** Zone polygon; its short name (no prefix) shows only when zoomed in enough to be readable. */
export function MapZoneLayer({
  zone,
  showLabel,
}: {
  readonly zone: MapZone;
  readonly showLabel: boolean;
}) {
  const styles = useStyles(createMapStyles);
  const center = centroidOf(zone.ring);
  return (
    <>
      <MapZoneShape zone={zone} />
      {center === null || !showLabel ? null : (
        <ViewAnnotation id={`zone-${zone.id}-label`} lngLat={[center[0], center[1]]}>
          <View style={styles.zoneLabel} pointerEvents="none" accessible accessibilityRole="text">
            <AppText variant="captionStrong">{zone.label}</AppText>
          </View>
        </ViewAnnotation>
      )}
    </>
  );
}
