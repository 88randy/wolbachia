import { CalendarDays, ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { kitShadow } from "../../ui/kit-styles.ts";
import type { HistoryGroup } from "./domain.ts";

/** One day of work: tap to open it. */
export function HistoryGroupCard({
  group,
  select,
}: {
  readonly group: HistoryGroup;
  readonly select: (id: string) => void;
}) {
  const t = useT();
  const { theme } = useTheme();
  const label = group.date ?? t("mobile.history.unknownTime");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${t("mobile.history.openShift")}`}
      onPress={() => {
        select(group.id);
      }}
      className="min-h-16 flex-row items-center gap-3 rounded-card border border-line bg-surface p-4 active:opacity-80"
      style={kitShadow.card}
    >
      <View className="h-12 w-12 items-center justify-center rounded-xl bg-tint">
        <CalendarDays color={theme.color.action} size={26} strokeWidth={2.25} />
      </View>
      <View className="flex-1">
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="caption" tone="secondary">
          {t("mobile.history.openShift")}
        </AppText>
      </View>
      <ChevronRight color={theme.color.text.tertiary} size={24} />
    </Pressable>
  );
}
