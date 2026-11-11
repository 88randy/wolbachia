import { View } from "react-native";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "../ui/AppText.tsx";
import { Badge } from "../ui/Badge.tsx";
import { MapDirectionsButton } from "./MapDirectionsButton.tsx";
import { createMapStyles } from "./map-styles.ts";
import type { MapPoint } from "./map-types.ts";

/** The selected point's card (code + status, never over the map), directions and attribution. */
export function MapFooter({
  point,
  showDirections,
}: {
  readonly point: MapPoint | null;
  readonly showDirections: boolean;
}) {
  const t = useT();
  const styles = useStyles(createMapStyles);
  return (
    <View style={styles.footer}>
      {point === null ? null : (
        <View style={styles.footerCard}>
          <AppText variant="h2">{point.label}</AppText>
          <View>
            <Badge tone={point.tone} icon={point.icon} label={point.statusLabel} />
          </View>
          {showDirections ? <MapDirectionsButton point={point} /> : null}
        </View>
      )}
      <AppText variant="caption">{t("mobile.map.attribution")}</AppText>
    </View>
  );
}
