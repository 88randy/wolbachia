import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { kitShadow } from "../../ui/kit-styles.ts";

interface Props {
  readonly completed: number;
  readonly total: number;
}

/** "Llevas 3 de 8" with a bar: where the courier is in the day, at a glance. */
export function RouteProgress({ completed, total }: Props) {
  const t = useT();
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t("field.day.progress", { completed, total })}
      accessibilityValue={{ min: 0, max: total, now: completed }}
      className="gap-3 rounded-card border border-line bg-surface p-4"
      style={kitShadow.card}
    >
      <AppText variant="h2">{t("field.day.progress", { completed, total })}</AppText>
      <View className="h-3 overflow-hidden rounded-full bg-line">
        <View className="h-3 rounded-full bg-success" style={{ width: `${String(percent)}%` }} />
      </View>
    </View>
  );
}
