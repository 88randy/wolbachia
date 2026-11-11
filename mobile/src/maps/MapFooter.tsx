import { View } from "react-native";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "../ui/AppText.tsx";
import { Badge } from "../ui/Badge.tsx";
import { MapDirectionsButton } from "./MapDirectionsButton.tsx";
import { createMapStyles } from "./map-styles.ts";
import type { MapPoint } from "./map-types.ts";

/** The selected point's card (code + status, never over the map) and directions. */
export function MapFooter({
  point,
  showDirections,
}: {
  readonly point: MapPoint | null;
  readonly showDirections: boolean;
}) {
  const styles = useStyles(createMapStyles);
  if (point === null) return null;
  return (
    <View style={styles.footer}>
      <View style={styles.footerCard}>
        <AppText variant="h2">{point.label}</AppText>
        <View>
          <Badge tone={point.tone} icon={point.icon} label={point.statusLabel} />
        </View>
        {showDirections ? <MapDirectionsButton point={point} /> : null}
      </View>
    </View>
  );
}
