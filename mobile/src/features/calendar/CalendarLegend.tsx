import { Clock } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { KIT_ICON_STROKE } from "../../ui/kit-styles.ts";

/** The grid markers in words: shapes are explained, never left to color. */
export function CalendarLegend() {
  const t = useT();
  const { theme } = useTheme();
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full bg-ink" />
        <AppText variant="caption">{t("mobile.calendar.legendActivity")}</AppText>
      </View>
      <View className="flex-row items-center gap-2">
        <Clock color={theme.color.status.warning.fg} size={12} strokeWidth={KIT_ICON_STROKE} />
        <AppText variant="caption">{t("mobile.calendar.legendPending")}</AppText>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="h-3 w-3 rounded border border-dashed border-line" />
        <AppText variant="caption">{t("mobile.calendar.outsideWindow")}</AppText>
      </View>
    </View>
  );
}
