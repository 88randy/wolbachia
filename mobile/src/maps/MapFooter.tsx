import { View } from "react-native";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "../ui/AppText.tsx";
import { Badge } from "../ui/Badge.tsx";
import { Button } from "../ui/Button.tsx";
import { MapDirectionsButton } from "./MapDirectionsButton.tsx";
import { createMapStyles } from "./map-styles.ts";
import type { MapPoint } from "./map-types.ts";

/** The selected point's card (code + status, never over the map) and directions. */
export function MapFooter({
  point,
  showDirections,
  onStart,
}: {
  readonly point: MapPoint | null;
  readonly showDirections: boolean;
  readonly onStart?: (id: string) => void;
}) {
  const styles = useStyles(createMapStyles);
  const t = useT();
  if (point === null) return null;
  return (
    <View style={styles.footer}>
      <View style={styles.footerCard}>
        <AppText variant="h2">{point.label}</AppText>
        {point.actionLabel ? (
          <AppText variant="bodyStrong" tone="secondary">
            {point.actionLabel}
          </AppText>
        ) : null}
        <View>
          <Badge tone={point.tone} icon={point.icon} label={point.statusLabel} />
        </View>
        {showDirections ? <MapDirectionsButton point={point} /> : null}
        {onStart && point.isStartable !== false ? (
          <Button
            label={t("field.day.start")}
            onPress={() => {
              onStart(point.id);
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
