import { View } from "react-native";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "../ui/AppText.tsx";
import { MapDirectionsButton } from "./MapDirectionsButton.tsx";
import { createMapStyles } from "./map-styles.ts";
import type { MapPoint } from "./map-types.ts";

/** Directions for the selected point plus the required map attribution. */
export function MapFooter({ point }: { readonly point: MapPoint | null }) {
  const t = useT();
  const styles = useStyles(createMapStyles);
  return (
    <View style={styles.footer}>
      {point === null ? null : <MapDirectionsButton point={point} />}
      <AppText variant="caption">{t("mobile.map.attribution")}</AppText>
    </View>
  );
}
