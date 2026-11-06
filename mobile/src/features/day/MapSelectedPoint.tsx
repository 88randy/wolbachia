import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";
import { PointDirections } from "./PointDirections.tsx";
import { markerState } from "./presentation.ts";
import { hasCoverage } from "./map-coverage.ts";
import { createDayStyles } from "./styles.ts";
import type { M06Model } from "./use-m-06.ts";
export function MapSelectedPoint({ model }: { readonly model: M06Model }) {
  const t = useT();
  const styles = useStyles(createDayStyles);
  const row = model.selected;
  if (row === null) return null;
  const status = markerState(row);
  return (
    <View style={styles.footer}>
      <AppText variant="button">{row.task.point_code}</AppText>
      <Badge tone={status.tone} icon={status.icon} label={t(status.key)} />
      {hasCoverage(row.task.quadrant_id, model.state?.map ?? { kind: "unavailable" }) ? null : (
        <AppText>{t("mobile.day.outsideCoverage")}</AppText>
      )}
      <PointDirections model={model} compact />
    </View>
  );
}
