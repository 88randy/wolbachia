import { ViewAnnotation } from "@maplibre/maplibre-react-native";
import { View } from "react-native";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "../ui/AppText.tsx";
import { MapZoneShape } from "./MapZoneShape.tsx";
import { centroidOf } from "./map-geo.ts";
import { createMapStyles } from "./map-styles.ts";
import type { MapZone } from "./map-types.ts";

/** Zone polygon with a text label at its center. */
export function MapZoneLayer({ zone }: { readonly zone: MapZone }) {
  const styles = useStyles(createMapStyles);
  const t = useT();
  const center = centroidOf(zone.ring);
  return (
    <>
      <MapZoneShape zone={zone} />
      {center === null ? null : (
        <ViewAnnotation id={`zone-${zone.id}-label`} lngLat={[center[0], center[1]]}>
          <View style={styles.zoneLabel} accessible accessibilityRole="text">
            <AppText variant="captionStrong">{t("mobile.map.zone", { name: zone.label })}</AppText>
          </View>
        </ViewAnnotation>
      )}
    </>
  );
}
