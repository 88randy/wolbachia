import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { useM06 } from "./use-m-06.ts";
import { createDayStyles } from "./styles.ts";
import { DayToggle } from "./DayToggle.tsx";
import { DayNotices } from "./DayNotices.tsx";
import { LocationNotice } from "./LocationNotice.tsx";
import { DayMap } from "./DayMap.tsx";
import { MapSelectedPoint } from "./MapSelectedPoint.tsx";
/** Full-screen map: no ScrollView/FlatList here or above MapRenderer. */
export function P10Screen() {
  const model = useM06();
  const t = useT();
  const styles = useStyles(createDayStyles);
  return (
    <View style={styles.root}>
      <ScreenHeader title={t("mobile.day.title")} />
      <DayToggle isMap />
      <DayNotices model={model} />
      <LocationNotice model={model} />
      <DayMap model={model} />
      <AppText variant="caption" style={styles.attribution}>
        {t("mobile.day.attribution")}
      </AppText>
      <MapSelectedPoint model={model} />
    </View>
  );
}
